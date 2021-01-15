import { mutate, responseInterface } from 'swr';

import { isUserPage, isSharedPage, isCreatablePage } from '~/utils/path-utils';
import {
  useTrash, useNotFound, useCurrentPagePath, useCurrentUser, useIsSharedUser, useForbidden,
} from './context';
import { useCurrentPageDeleted, useDescendentsCount, useCurrentPageSWR } from './page';
import { useStaticSWR } from './use-static-swr';
import { Page } from '~/interfaces/page';

export const useIsAbleToShowEmptyTrashButton = (): responseInterface<boolean, Error> => {
  const { data: currentUser } = useCurrentUser();
  const { data: currentPagePath } = useCurrentPagePath();
  const { data: descendentsCount } = useDescendentsCount(currentPagePath);

  const hasChildren = (descendentsCount || 0) > 0;
  const isAbleToShowEmptyTrashButton = currentUser != null && currentUser.admin && currentPagePath === '/trash' && hasChildren;

  return useStaticSWR('isAbleToShowEmptyTrashButton', isAbleToShowEmptyTrashButton);
};

export const useIsAbleToShowTrashPageManagementButtons = (): responseInterface<boolean, Error> => {
  const { data: currentUser } = useCurrentUser();
  const { data: isDeleted } = useCurrentPageDeleted();

  return useStaticSWR('isAbleToShowTrashPageManagementButtons', isDeleted && currentUser != null);
};

export const useIsAbleToShowPageReactionButtons = (): responseInterface<boolean, any> => {
  const { data: isTrashPage } = useTrash();
  const { data: isNotFoundPage } = useNotFound();
  const { data: isSharedUser } = useIsSharedUser();

  return useStaticSWR('isAbleToShowPageReactionButtons', !isTrashPage && !isNotFoundPage && !isSharedUser);
};

export const useIsAbleToShowLikeButton = (): responseInterface<boolean, any> => {
  const { data: isSharedUser } = useIsSharedUser();
  const { data: page } = useCurrentPageSWR();

  if (page == null) {
    throw new Error('page must not be null');
  }
  return useStaticSWR('isAbleToShowLikeButton', !isUserPage(page.path) && !isSharedUser);
};

export const useIsAbleToShowTagLabel = (): responseInterface<boolean, any> => {
  const key = 'isAbleToShowTagLabel';
  const { data: page } = useCurrentPageSWR();

  if (page == null) {
    mutate(key, false);
  }
  else {
    const { path } = page as Page;
    mutate(key, !isUserPage(path) && !isSharedPage(path));
  }

  // [TODO: add other two judgements and expand isAbleToShowTagLabel by GW-4881]
  // isAbleToShowTagLabel = (!isCompactMode && !isUserPage && !isSharedPage && !(editorMode === 'view' && !isPageExist));
  return useStaticSWR(key);
};

export const useIsAbleToShowPageAuthors = (): responseInterface<boolean, any> => {
  const key = 'isAbleToShowPageAuthors';
  const { data: page } = useCurrentPageSWR();
  const { data: isNotFoundPage } = useNotFound();

  if (page == null) {
    mutate(key, false);
  }
  else {
    mutate(key, !isNotFoundPage && !isUserPage(page.path));
  }

  return useStaticSWR(key);
};

export const useIsAbleToShowPageManagement = (): responseInterface<boolean, any> => {
  const { data: isNotFoundPage } = useNotFound();
  const { data: isTrashPage } = useTrash();
  const { data: isSharedUser } = useIsSharedUser();

  return useStaticSWR('isAbleToShowPageManagement', !isNotFoundPage && !isTrashPage && !isSharedUser);
};

export const useIsAbleToShowPageEditorModeManager = (): responseInterface<boolean, any> | false => {
  const key = 'isAbleToShowPageEditorModeManager';

  const { data: isForbidden } = useForbidden();
  const { data: isTrashPage } = useTrash();
  const { data: isSharedUser } = useIsSharedUser();
  const { data: page } = useCurrentPageSWR();

  if (page == null) {
    mutate(key, false);
  }
  else {
    mutate(key, isCreatablePage(page.path) && !isForbidden && !isTrashPage && !isSharedUser);
  }

  return useStaticSWR(key);
};