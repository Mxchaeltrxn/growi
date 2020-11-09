import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import loggerFactory from '@alias/logger';

import NavigationContainer from '../services/NavigationContainer';

import { withUnstatedContainers } from './UnstatedUtils';

import RecentlyCreatedIcon from './Icons/RecentlyCreatedIcon';

// eslint-disable-next-line no-unused-vars
const logger = loggerFactory('growi:cli:UserContentsLinks');
const WIKI_HEADER_LINK = 120;

/**
 * @author Yuki Takei <yuki@weseek.co.jp>
 *
 */
const UserContentsLinks = (props) => {

  const { navigationContainer } = props;

  // get element for smoothScroll
  const getBookMarkListHeaderDom = useMemo(() => { return document.getElementById('bookmarks-list') }, []);
  const getRecentlyCreatedListHeaderDom = useMemo(() => { return document.getElementById('recently-created-list') }, []);

  return (
    <div className="mt-3 d-flex justify-content-around">
      <button
        type="button"
        className="btn btn-outline-secondary btn-sm"
        onClick={() => navigationContainer.smoothScrollIntoView(getBookMarkListHeaderDom, WIKI_HEADER_LINK)}
      >
        <i className="mr-2 icon-star"></i>
        <span>Bookmarks</span>
      </button>
      <button
        type="button"
        className="btn btn-outline-secondary btn-sm"
        onClick={() => navigationContainer.smoothScrollIntoView(getRecentlyCreatedListHeaderDom, WIKI_HEADER_LINK)}
      >
        <i className="grw-icon-container-recently-created mr-2"><RecentlyCreatedIcon /></i>
        <span>Recently Created</span>
      </button>
    </div>
  );

};

UserContentsLinks.propTypes = {
  navigationContainer: PropTypes.instanceOf(NavigationContainer).isRequired,
};

export default withUnstatedContainers(UserContentsLinks, [NavigationContainer]);
