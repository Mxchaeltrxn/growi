import React from 'react';

import { useCustomizeSettingsSWR } from '~/stores/admin';

import { CustomizeThemeSetting } from '~/components/Admin/Customize/CustomizeThemeSetting';
import CustomizeFunctionSetting from '~/client/js/components/Admin/Customize/CustomizeFunctionSetting';
import CustomizeHighlightSetting from '~/client/js/components/Admin/Customize/CustomizeHighlightSetting';
import CustomizeTitle from '~/client/js/components/Admin/Customize/CustomizeTitle';
import CustomizeHeaderSetting from '~/client/js/components/Admin/Customize/CustomizeHeaderSetting';
import CustomizeCssSetting from '~/client/js/components/Admin/Customize/CustomizeCssSetting';
import CustomizeScriptSetting from '~/client/js/components/Admin/Customize/CustomizeScriptSetting';

const CustomizeSettingContents = (): JSX.Element => {
  const { isValidating } = useCustomizeSettingsSWR();

  if (isValidating) {
    return (
      <div className="my-5 text-center">
        <i className="fa fa-lg fa-spinner fa-pulse mx-auto text-muted" />
      </div>
    );
  }

  return (
    <React.Fragment>
      <div className="mb-5">
        <CustomizeThemeSetting />
      </div>
      {/* <div className="mb-5">
        <CustomizeFunctionSetting />
      </div>
      <div className="mb-5">
        <CustomizeHighlightSetting />
      </div>
      <div className="mb-5">
        <CustomizeTitle />
      </div>
      <div className="mb-5">
        <CustomizeHeaderSetting />
      </div>
      <div className="mb-5">
        <CustomizeCssSetting />
      </div>
      <div className="mb-5">
        <CustomizeScriptSetting />
      </div> */}
    </React.Fragment>
  );
};

export default CustomizeSettingContents;
