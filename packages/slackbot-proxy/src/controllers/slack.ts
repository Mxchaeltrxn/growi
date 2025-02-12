import {
  BodyParams, Controller, Get, Inject, Post, Req, Res, UseBefore,
} from '@tsed/common';

import axios from 'axios';

import { WebAPICallResult } from '@slack/web-api';

import {
  markdownSectionBlock, GrowiCommand, parseSlashCommand, postEphemeralErrors, verifySlackRequest, generateWebClient,
  InvalidGrowiCommandError,
} from '@growi/slack';

import { Relation } from '~/entities/relation';
import { SlackOauthReq } from '~/interfaces/slack-to-growi/slack-oauth-req';
import { InstallationRepository } from '~/repositories/installation';
import { RelationRepository } from '~/repositories/relation';
import { OrderRepository } from '~/repositories/order';
import { AddSigningSecretToReq } from '~/middlewares/slack-to-growi/add-signing-secret-to-req';
import { AuthorizeCommandMiddleware, AuthorizeInteractionMiddleware } from '~/middlewares/slack-to-growi/authorizer';
import { ExtractGrowiUriFromReq } from '~/middlewares/slack-to-growi/extract-growi-uri-from-req';
import { InstallerService } from '~/services/InstallerService';
import { SelectGrowiService } from '~/services/SelectGrowiService';
import { RegisterService } from '~/services/RegisterService';
import { RelationsService } from '~/services/RelationsService';
import { UnregisterService } from '~/services/UnregisterService';
import { InvalidUrlError } from '../models/errors';
import loggerFactory from '~/utils/logger';
import { JoinToConversationMiddleware } from '~/middlewares/slack-to-growi/join-to-conversation';


const logger = loggerFactory('slackbot-proxy:controllers:slack');


@Controller('/slack')
export class SlackCtrl {

  @Inject()
  installerService: InstallerService;

  @Inject()
  installationRepository: InstallationRepository;

  @Inject()
  relationRepository: RelationRepository;

  @Inject()
  orderRepository: OrderRepository;

  @Inject()
  selectGrowiService: SelectGrowiService;

  @Inject()
  registerService: RegisterService;

  @Inject()
  relationsService: RelationsService;

  @Inject()
  unregisterService: UnregisterService;

  /**
   * Send command to specified GROWIs
   * @param growiCommand
   * @param relations
   * @param body
   * @returns
   */
  private async sendCommand(growiCommand: GrowiCommand, relations: Relation[], body: any) {
    if (relations.length === 0) {
      throw new Error('relations must be set');
    }
    const botToken = relations[0].installation?.data.bot?.token; // relations[0] should be exist

    const promises = relations.map((relation: Relation) => {
      // generate API URL
      const url = new URL('/_api/v3/slack-integration/proxied/commands', relation.growiUri);
      return axios.post(url.toString(), {
        ...body,
        growiCommand,
      }, {
        headers: {
          'x-growi-ptog-tokens': relation.tokenPtoG,
        },
      });
    });

    // pickup PromiseRejectedResult only
    const results = await Promise.allSettled(promises);
    const rejectedResults: PromiseRejectedResult[] = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');

    try {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return postEphemeralErrors(rejectedResults, body.channel_id, body.user_id, botToken!);
    }
    catch (err) {
      logger.error(err);
    }
  }

  @Post('/commands')
  @UseBefore(AddSigningSecretToReq, verifySlackRequest, AuthorizeCommandMiddleware, JoinToConversationMiddleware)
  async handleCommand(@Req() req: SlackOauthReq, @Res() res: Res): Promise<void|string|Res|WebAPICallResult> {
    const { body, authorizeResult } = req;

    let growiCommand;

    try {
      growiCommand = parseSlashCommand(body);
    }
    catch (err) {
      if (err instanceof InvalidGrowiCommandError) {
        res.json({
          blocks: [
            markdownSectionBlock('*Command type is not specified.*'),
            markdownSectionBlock('Run `/growi help` to check the commands you can use.'),
          ],
        });
      }
      logger.error(err.message);
      return;
    }

    // register
    if (growiCommand.growiCommandType === 'register') {
      // Send response immediately to avoid opelation_timeout error
      // See https://api.slack.com/apis/connections/events-api#the-events-api__responding-to-events
      res.send();

      return this.registerService.process(growiCommand, authorizeResult, body as {[key:string]:string});
    }

    // unregister
    if (growiCommand.growiCommandType === 'unregister') {
      if (growiCommand.growiCommandArgs.length === 0) {
        return 'GROWI Urls is required.';
      }
      if (!growiCommand.growiCommandArgs.every(v => v.match(/^(https?:\/\/)/))) {
        return 'GROWI Urls must be urls.';
      }

      // Send response immediately to avoid opelation_timeout error
      // See https://api.slack.com/apis/connections/events-api#the-events-api__responding-to-events
      res.send();

      return this.unregisterService.process(growiCommand, authorizeResult, body as {[key:string]:string});
    }

    const installationId = authorizeResult.enterpriseId || authorizeResult.teamId;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const installation = await this.installationRepository.findByTeamIdOrEnterpriseId(installationId!);
    const relations = await this.relationRepository.createQueryBuilder('relation')
      .where('relation.installationId = :id', { id: installation?.id })
      .leftJoinAndSelect('relation.installation', 'installation')
      .getMany();

    if (relations.length === 0) {
      return res.json({
        blocks: [
          markdownSectionBlock('*No relation found.*'),
          markdownSectionBlock('Run `/growi register` first.'),
        ],
      });
    }

    // status
    if (growiCommand.growiCommandType === 'status') {
      return res.json({
        blocks: [
          markdownSectionBlock('*Found Relations to GROWI.*'),
          ...relations.map(relation => markdownSectionBlock(`GROWI url: ${relation.growiUri}`)),
        ],
      });
    }

    // Send response immediately to avoid opelation_timeout error
    // See https://api.slack.com/apis/connections/events-api#the-events-api__responding-to-events
    res.send();

    const baseDate = new Date();

    const allowedRelationsForSingleUse:Relation[] = [];
    const disallowedGrowiUrls: Set<string> = new Set();

    // check permission for single use
    await Promise.all(relations.map(async(relation) => {
      const isSupported = await this.relationsService.isSupportedGrowiCommandForSingleUse(relation, growiCommand.growiCommandType, baseDate);
      if (isSupported) {
        allowedRelationsForSingleUse.push(relation);
      }
      else {
        disallowedGrowiUrls.add(relation.growiUri);
      }
    }));

    // select GROWI
    if (allowedRelationsForSingleUse.length > 0) {
      body.growiUrisForSingleUse = allowedRelationsForSingleUse.map(v => v.growiUri);
      return this.selectGrowiService.process(growiCommand, authorizeResult, body);
    }

    // check permission for broadcast use
    const relationsForBroadcastUse:Relation[] = [];
    await Promise.all(relations.map(async(relation) => {
      const isSupported = await this.relationsService.isSupportedGrowiCommandForBroadcastUse(relation, growiCommand.growiCommandType, baseDate);
      if (isSupported) {
        relationsForBroadcastUse.push(relation);
      }
      else {
        disallowedGrowiUrls.add(relation.growiUri);
      }
    }));

    // forward to GROWI server
    if (relationsForBroadcastUse.length > 0) {
      this.sendCommand(growiCommand, relationsForBroadcastUse, body);
    }

    // when all of GROWI disallowed
    if (relations.length === disallowedGrowiUrls.size) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const client = generateWebClient(authorizeResult.botToken!);

      const linkUrlList = Array.from(disallowedGrowiUrls).map((growiUrl) => {
        return '\n'
          + `• ${new URL('/admin/slack-integration', growiUrl).toString()}`;
      });

      return client.chat.postEphemeral({
        text: 'Error occured.',
        channel: body.channel_id,
        user: body.user_id,
        blocks: [
          markdownSectionBlock('*None of GROWI permitted the command.*'),
          markdownSectionBlock(`*'${growiCommand.growiCommandType}'* command was not allowed.`),
          markdownSectionBlock(
            `To use this command, modify settings from following pages: ${linkUrlList}`,
          ),
        ],
      });
    }
  }

  @Post('/interactions')
  @UseBefore(AuthorizeInteractionMiddleware, ExtractGrowiUriFromReq)
  async handleInteraction(@Req() req: SlackOauthReq, @Res() res: Res): Promise<void|string|Res|WebAPICallResult> {
    logger.info('receive interaction', req.authorizeResult);
    logger.debug('receive interaction', req.body);

    const { body, authorizeResult } = req;

    // Send response immediately to avoid opelation_timeout error
    // See https://api.slack.com/apis/connections/events-api#the-events-api__responding-to-events
    res.send();

    // pass
    if (body.ssl_check != null) {
      return;
    }

    const installationId = authorizeResult.enterpriseId || authorizeResult.teamId;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const installation = await this.installationRepository.findByTeamIdOrEnterpriseId(installationId!);

    const payload = JSON.parse(body.payload);
    const callBackId = payload?.view?.callback_id;

    // register
    if (callBackId === 'register') {
      try {
        await this.registerService.insertOrderRecord(installation, authorizeResult.botToken, payload);
      }
      catch (err) {
        if (err instanceof InvalidUrlError) {
          logger.info(err.message);
          return;
        }
        logger.error(err);
      }

      await this.registerService.notifyServerUriToSlack(authorizeResult.botToken, payload);
      return;
    }

    // unregister
    if (callBackId === 'unregister') {
      await this.unregisterService.unregister(installation, authorizeResult, payload);
      return;
    }

    // forward to GROWI server
    if (callBackId === 'select_growi') {
      const selectedGrowiInformation = await this.selectGrowiService.handleSelectInteraction(installation, payload);
      return this.sendCommand(selectedGrowiInformation.growiCommand, [selectedGrowiInformation.relation], selectedGrowiInformation.sendCommandBody);
    }

    /*
    * forward to GROWI server
    */
    const relation = await this.relationRepository.findOne({ installation, growiUri: req.growiUri });

    if (relation == null) {
      logger.error('*No relation found.*');
      return;
    }

    try {
      // generate API URL
      const url = new URL('/_api/v3/slack-integration/proxied/interactions', req.growiUri);
      await axios.post(url.toString(), {
        ...body,
      }, {
        headers: {
          'x-growi-ptog-tokens': relation.tokenPtoG,
        },
      });
    }
    catch (err) {
      logger.error(err);
    }
  }

  @Post('/events')
  async handleEvent(@BodyParams() body:{[key:string]:string} /* , @Res() res: Res */): Promise<void|string> {
    // eslint-disable-next-line max-len
    // see: https://api.slack.com/apis/connections/events-api#the-events-api__subscribing-to-event-types__events-api-request-urls__request-url-configuration--verification
    if (body.type === 'url_verification') {
      return body.challenge;
    }

    logger.info('receive event', body);

    return;
  }

  @Get('/oauth_redirect')
  async handleOauthRedirect(@Req() req: Req, @Res() res: Res): Promise<void> {

    if (req.query.state === '') {
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<html>'
      + '<head><meta name="viewport" content="width=device-width,initial-scale=1"></head>'
      + '<body style="text-align:center; padding-top:20%;">'
      + '<h1>Illegal state, try it again.</h1>'
      + '<a href="/">'
      + 'Go to install page'
      + '</a>'
      + '</body></html>');
    }

    await this.installerService.installer.handleCallback(req, res, {
      success: (installation, metadata, req, res) => {
        logger.info('Success to install', { installation, metadata });

        const appPageUrl = `https://slack.com/apps/${installation.appId}`;

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<html>'
        + '<head><meta name="viewport" content="width=device-width,initial-scale=1">'
        + '<link href="/bootstrap/css/bootstrap.min.css" rel="stylesheet">'
        + '</head>'
        + '<body style="text-align:center; padding-top:20%;">'
        + '<h1>Congratulations!</h1>'
        + '<p>GROWI Bot installation has succeeded.</p>'
        + '<div class="d-inline-flex flex-column">'
        + `<a class="mb-3" href="${appPageUrl}">`
        + 'Access to Slack App detail page.'
        + '</a>'
        + '<a class="btn btn-outline-success" href="https://docs.growi.org/en/admin-guide/management-cookbook/slack-integration/official-bot-settings.html">'
        + 'Getting started'
        + '</a>'
        + '</div>'
        + '</body></html>');
      },
      failure: (error, installOptions, req, res) => {
        res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<html>'
        + '<head><meta name="viewport" content="width=device-width,initial-scale=1"></head>'
        + '<body style="text-align:center; padding-top:20%;">'
        + '<h1>GROWI Bot installation failed</h1>'
        + '<p>Please contact administrators of your workspace</p>'
        + 'Reference: <a href="https://slack.com/help/articles/222386767-Manage-app-installation-settings-for-your-workspace">'
        + 'Manage app installation settings for your workspace'
        + '</a>'
        + '</body></html>');
      },
    });
  }

}
