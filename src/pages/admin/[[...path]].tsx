import {
  NextPage, GetServerSideProps, GetServerSidePropsContext,
} from 'next';
import { useRouter } from 'next/router';

import AdminLayout from '~/components/AdminLayout';

import { useTranslation } from '~/i18n';
import { CrowiRequest } from '~/interfaces/crowi-request';
import { CommonProps, getServerSideCommonProps, useCustomTitle } from '~/utils/nextjs-page-utils';
import PluginUtils from '~/server/plugins/plugin-utils';
import ConfigLoader from '~/server/service/config-loader';

import { AdminHome } from '~/components/Admin/Home/AdminHome';
import AppSettingsPageContents from '~/components/Admin/App/AppSettingsPageContents';
import { SecurityManagementContents } from '~/components/Admin/Security/SecurityManagementContents';
import MarkDownSettingContents from '~/components/Admin/Markdown/MarkDownSettingContents';
import CustomizeSettingContents from '~/components/Admin/Customize/CustomizeSettingContents';
import DataImportPageContents from '~/components/Admin/DataImport/DataImportPageContents';
import { ExportArchiveDataPage } from '~/components/Admin/DataExport/ExportArchiveDataPage';

import {
  useCurrentUser,
  useSearchServiceConfigured, useSearchServiceReachable,
} from '../../stores/context';

const pluginUtils = new PluginUtils();

type Props = CommonProps & {
  currentUser: any,

  nodeVersion: string,
  npmVersion: string,
  yarnVersion: string,
  installedPlugins: any,
  envVars: any,

  isSearchServiceConfigured: boolean,
  isSearchServiceReachable: boolean,
};

const AdminMarkdownSettingsPage: NextPage<Props> = (props: Props) => {
  const { t } = useTranslation();
  const router = useRouter();
  const path = router.query.path || 'home';
  const name = Array.isArray(path) ? path[0] : path;

  const adminPagesMap = {
    home: {
      title: t('Wiki Management Home Page'),
      component: <AdminHome
        nodeVersion={props.nodeVersion}
        npmVersion={props.npmVersion}
        yarnVersion={props.yarnVersion}
        installedPlugins={props.installedPlugins}
        envVars={props.envVars}
      />,
    },
    app: {
      title: useCustomTitle(props, t('App Settings')),
      component: <AppSettingsPageContents />,
    },
    security: {
      title: useCustomTitle(props, t('App Settings')),

      component: <SecurityManagementContents />,
    },
    markdown: {
      title: useCustomTitle(props, t('Markdown Settings')),
      component: <MarkDownSettingContents />,
    },
    customize: {
      title: useCustomTitle(props, t('Customize Settings')),
      component: <CustomizeSettingContents />,
    },
    importer: {
      title: useCustomTitle(props, t('Import Data')),
      component: <DataImportPageContents />,
    },
    export: {
      title: useCustomTitle(props, t('Export Archive Data')),
      component: <ExportArchiveDataPage />,
    },
    notification: {
      title: useCustomTitle(props, t('')),
      component: <></>,
    },
    'global-notification': {
      title: useCustomTitle(props, t('')),
      component: <></>,
    },
    users: {
      title: useCustomTitle(props, t('')),
      component: <></>,
    },
    'user-groups': {
      title: useCustomTitle(props, t('')),
      component: <></>,
    },
    search: {
      title: useCustomTitle(props, t('')),
      component: <></>,
    },
  };

  const content = adminPagesMap[name];
  const title = content.title;

  useCurrentUser(props.currentUser != null ? JSON.parse(props.currentUser) : null);

  useSearchServiceConfigured(props.isSearchServiceConfigured);
  useSearchServiceReachable(props.isSearchServiceReachable);

  return (
    <AdminLayout title={title} selectedNavOpt={name}>
      {content.component}
    </AdminLayout>
  );
};

export const getServerSideProps: GetServerSideProps = async(context: GetServerSidePropsContext) => {
  const req: CrowiRequest = context.req as CrowiRequest;
  const { crowi } = req;
  const {
    searchService,
  } = crowi;

  const { user } = req;

  const result = await getServerSideCommonProps(context);

  // check for presence
  // see: https://github.com/vercel/next.js/issues/19271#issuecomment-730006862
  if (!('props' in result)) {
    throw new Error('invalid getSSP result');
  }
  const props: Props = result.props as Props;
  if (user != null) {
    props.currentUser = JSON.stringify(user.toObject());
  }

  props.nodeVersion = crowi.runtimeVersions.versions.node ? crowi.runtimeVersions.versions.node.version.version : null;
  props.npmVersion = crowi.runtimeVersions.versions.npm ? crowi.runtimeVersions.versions.npm.version.version : null;
  props.yarnVersion = crowi.runtimeVersions.versions.yarn ? crowi.runtimeVersions.versions.yarn.version.version : null;
  props.installedPlugins = pluginUtils.listPlugins();
  props.envVars = await ConfigLoader.getEnvVarsForDisplay(true);

  props.isSearchServiceConfigured = searchService.isConfigured;
  props.isSearchServiceReachable = searchService.isReachable;

  return {
    props,
  };
};

export default AdminMarkdownSettingsPage;
