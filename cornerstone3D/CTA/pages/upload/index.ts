require("./template.css");
import {
    RenderingEngine,
    Types,
    Enums,
    setVolumesForViewports,
    volumeLoader,
    getRenderingEngine,
    init
  } from '@cornerstonejs/core';

import * as cornerstoneTools from '@cornerstonejs/tools';
import {cornerstoneNiftiImageVolumeLoader} from '@cornerstonejs/nifti-volume-loader';
import { COLOR_LUT } from 'tools/src/constants';
import slabThicknessSyncCallback from 'tools/src/synchronizers/callbacks/slabThicknessSyncCallback';
const {
    ToolGroupManager,
    Enums: csToolsEnums,
    WindowLevelTool,
    PanTool,
    ZoomTool,
    StackScrollMouseWheelTool,
    synchronizers,
    MIPJumpToClickTool,
    VolumeRotateMouseWheelTool,
    CrosshairsTool,
    TrackballRotateTool,
  } = cornerstoneTools;
const { MouseBindings } = csToolsEnums;
const { ViewportType, BlendModes } = Enums;

let renderingEngine;
const renderingEngineId = 'myRenderingEngine';
const toolGroupId = 'TOOLGROUP_ID';

let volumeId;
let volume;
let toolGroup;
let niftiName;

const viewportIds = {
    axial: 'AXIAL', sagittal: 'SAGITTAL', coronal: 'CORONAL'
};
const viewportColors = {
  [viewportIds.axial]: 'rgb(250, 110, 110)',
  [viewportIds.sagittal]: 'rgb(250, 250, 110)',
  [viewportIds.coronal]: 'rgb(110, 250, 110)'
};

let element_axial;
let element_sagittal;
let element_coronal;
function getReferenceLineColor(viewportId) {
  return viewportColors[viewportId];
}

function setUpToolGroups(){
  
  toolGroup.addViewport(viewportIds.axial, renderingEngineId);
  toolGroup.addViewport(viewportIds.sagittal, renderingEngineId);
  toolGroup.addViewport(viewportIds.coronal, renderingEngineId);
  
  console.log("加载工具中")
  toolGroup.setToolActive(CrosshairsTool.toolName, {
    bindings: [{
      mouseButton: MouseBindings.Primary, // 左键
    }],
  });
  toolGroup.setToolActive(PanTool.toolName, {
    bindings: [{
      mouseButton: MouseBindings.Auxiliary, // 中键
    }],
  });
  toolGroup.setToolActive(ZoomTool.toolName, {
    bindings: [{
        mouseButton: MouseBindings.Secondary, // 右键
    }],
  });
  toolGroup.setToolActive(StackScrollMouseWheelTool.toolName); // 滚轮
  console.log("加载完成");
}
async function setUpDisplay(){
  const viewportInput = [
    {
      viewportId: viewportIds.axial,
      type: ViewportType.ORTHOGRAPHIC,
      element: element_axial,
      defaultOptions: {
        orientation: Enums.OrientationAxis.AXIAL,
      },
    },
    {
      viewportId: viewportIds.sagittal,
      type: ViewportType.ORTHOGRAPHIC,
      element: element_sagittal,
      defaultOptions: {
        orientation: Enums.OrientationAxis.SAGITTAL,
      },
    },
    {
      viewportId: viewportIds.coronal,
      type: ViewportType.ORTHOGRAPHIC,
      element: element_coronal,
      defaultOptions: {
        orientation: Enums.OrientationAxis.CORONAL,
      },
    }
  ];
  viewportInput.forEach(element => {
    renderingEngine.enableElement(element);
  });
  
  renderingEngine.setViewports(viewportInput);
  volume.load();
  await setVolumesForViewports(
    renderingEngine,
    [{volumeId}],
    [viewportIds.axial, viewportIds.sagittal, viewportIds.coronal]
  );
  renderingEngine.render();
}

async function onUpdate(event){
  if(this.files.length == 0){
    return;
  }
  const previewPage = document.getElementById("previewPage");
  const welcomeText = document.getElementById("welcomeText");
  const resultLoading = document.getElementById("resultLoading");
  welcomeText.classList.remove("show");
  welcomeText.classList.add("fade");
  previewPage.classList.remove("show");
  previewPage.classList.add("fade");
  resultLoading.classList.remove("fade")
  resultLoading.classList.add("show");
  var reader = new FileReader();
  const fileNameSpan = document.getElementById("fileName");
  fileNameSpan.innerHTML = this.files[0].name;
  niftiName = this.files[0].name;
  reader.readAsDataURL(this.files[0]);
  reader.onload = async function(){
    const previewPage = document.getElementById("previewPage");
    volumeId = 'nifti:'+reader.result;
    volume = await volumeLoader.createAndCacheVolume(volumeId);
    await setUpDisplay();
    previewPage.style.visibility = "visible";
    previewPage.style.zIndex = "10";
    previewPage.classList.remove("fade");
    previewPage.classList.add("show");
    setUpToolGroups();
  }
}

async function onSubmit(event){
  if(niftiName != null){
    event.preventDefault();
    location.href ="/result?file="+niftiName;
  }
}

async function Load(){
  await init();
  await cornerstoneTools.init()
  element_axial = document.getElementById("viewport-axial");
  element_sagittal = document.getElementById("viewport-sagittal")
  element_coronal = document.getElementById("viewport-coronal")
  //注册volumnLoader
  volumeLoader.registerVolumeLoader(
    "nifti",
    cornerstoneNiftiImageVolumeLoader
  );

  //关闭鼠标右键点击
  element_axial.oncontextmenu = (e)=>e.preventDefault();
  element_sagittal.oncontextmenu = (e)=>e.preventDefault();
  element_coronal.oncontextmenu = (e)=>e.preventDefault();

  //关闭鼠标中键作用
  document.addEventListener('mousedown', function(event) {
    if (event.button === 1) {
        event.preventDefault();
    }
  });
  renderingEngine = new RenderingEngine(renderingEngineId);
  
  cornerstoneTools.addTool(PanTool);
  cornerstoneTools.addTool(ZoomTool);
  cornerstoneTools.addTool(StackScrollMouseWheelTool);
  cornerstoneTools.addTool(CrosshairsTool);
  
  toolGroup = ToolGroupManager.createToolGroup(toolGroupId);
  toolGroup.addTool(PanTool.toolName);
  toolGroup.addTool(ZoomTool.toolName);
  toolGroup.addTool(StackScrollMouseWheelTool.toolName);
  toolGroup.addTool(CrosshairsTool.toolName,{
    getReferenceLineColor
  });

  document
    .getElementById("upload")
    .addEventListener("change", onUpdate);
  
  document
    .getElementById("submit")
    .addEventListener("click", onSubmit);
}

Load();