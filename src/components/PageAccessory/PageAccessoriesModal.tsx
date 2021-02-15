import React, {
  FC, useCallback, useMemo, useState,
} from 'react';

import {
  Modal, ModalBody, ModalHeader, TabContent, TabPane,
} from 'reactstrap';

import PageListIcon from '../../client/js/components/Icons/PageListIcon';
import TimeLineIcon from '../../client/js/components/Icons/TimeLineIcon';
import HistoryIcon from '../../client/js/components/Icons/HistoryIcon';
import AttachmentIcon from '../../client/js/components/Icons/AttachmentIcon';
import ShareLinkIcon from '../../client/js/components/Icons/ShareLinkIcon';

import PageAttachment from '../../client/js/components/PageAttachment';
import PageTimeline from '../../client/js/components/PageTimeline';
import PageList from '../../client/js/components/PageList';
import PageHistory from './PageHistory';
import ShareLink from '../../client/js/components/ShareLink/ShareLink';
import { CustomNavTab } from '../../client/js/components/CustomNavigation/CustomNav';
import ExpandOrContractButton from '../../client/js/components/ExpandOrContractButton';

type Props = {
  isGuestUser: boolean;
  isSharedUser: boolean;
  isOpen: boolean;
  onClose?: ()=>void;
}

export const PageAccessoriesModal:FC<Props> = (props:Props) => {
  const { isOpen, onClose } = props;
  const [isWindowExpanded, setIsWindowExpanded] = useState(false);

  const expandWindow = () => {
    setIsWindowExpanded(true);
  };

  const contractWindow = () => {
    setIsWindowExpanded(false);
  };

  const closeModalHandler = useCallback(() => {
    if (onClose == null) {
      return;
    }
    onClose();
  }, [onClose]);

  const buttons = (
    <div className="d-flex flex-nowrap">
      <ExpandOrContractButton
        isWindowExpanded={isWindowExpanded}
        expandWindow={expandWindow}
        contractWindow={contractWindow}
      />
      <button type="button" className="close" onClick={closeModalHandler} aria-label="Close">
        <span aria-hidden="true">&times;</span>
      </button>
    </div>
  );

  return (
    <Modal
      size="xl"
      isOpen={isOpen}
      toggle={closeModalHandler}
      className={`grw-page-accessories-modal ${isWindowExpanded ? 'grw-modal-expanded' : ''} `}
    >
      <ModalHeader className="p-0" toggle={closeModalHandler} close={buttons}>
        {/* <CustomNavTab
          activeTab={activeTab}
          navTabMapping={navTabMapping}
          onNavSelected={switchActiveTab}
          breakpointToHideInactiveTabsDown="md"
          hideBorderBottom
        /> */}
      </ModalHeader>
      <ModalBody className="overflow-auto grw-modal-body-style p-0">
        {/* Do not use CustomTabContent because of performance problem:
              the 'navTabMapping[tabId].Content' for PageAccessoriesModal depends on activeComponents */}
        {/* <TabContent activeTab={activeTab} className="p-5">
          <TabPane tabId="pagelist">
            {activeComponents.has('pagelist') && <PageList />}
          </TabPane>
          <TabPane tabId="timeline">
            {activeComponents.has('timeline') && <PageTimeline /> }
          </TabPane>
          {!isGuestUser && (
          <TabPane tabId="pageHistory">
            {activeComponents.has('pageHistory') && <PageHistory /> }
          </TabPane>
            )}
          <TabPane tabId="attachment">
            {activeComponents.has('attachment') && <PageAttachment />}
          </TabPane>
          {!isGuestUser && (
          <TabPane tabId="shareLink">
            {activeComponents.has('shareLink') && <ShareLink />}
          </TabPane>
            )}
        </TabContent> */}
      </ModalBody>
    </Modal>
  );
};

//   const navTabMapping = useMemo(() => {
//     return {
//       pagelist: {
//         Icon: PageListIcon,
//         i18n: t('page_list'),
//         index: 0,
//         isLinkEnabled: v => !isSharedUser,
//       },
//       timeline: {
//         Icon: TimeLineIcon,
//         i18n: t('Timeline View'),
//         index: 1,
//         isLinkEnabled: v => !isSharedUser,
//       },
//       pageHistory: {
//         Icon: HistoryIcon,
//         i18n: t('History'),
//         index: 2,
//         isLinkEnabled: v => !isGuestUser && !isSharedUser,
//       },
//       attachment: {
//         Icon: AttachmentIcon,
//         i18n: t('attachment_data'),
//         index: 3,
//       },
//       shareLink: {
//         Icon: ShareLinkIcon,
//         i18n: t('share_links.share_link_management'),
//         index: 4,
//         isLinkEnabled: v => !isGuestUser && !isSharedUser,
//       },
//     };
//   }, [t, isGuestUser, isSharedUser]);
