import {
  RenderingEngine,
  Types,
  Enums,
  setVolumesForViewports,
  volumeLoader,
  getRenderingEngine,
  
} from '@cornerstonejs/core';
import {
  initDemo,
  createImageIdsAndCacheMetaData,
  setTitleAndDescription,
  setPetColorMapTransferFunctionForVolumeActor,
  setPetTransferFunctionForVolumeActor,
  setCtTransferFunctionForVolumeActor,
  addDropdownToToolbar,
  addButtonToToolbar,
} from '@cornerstonejs/helpers';
import * as cornerstoneTools from '@cornerstonejs/tools';
import {cornerstoneNiftiImageVolumeLoader} from '@cornerstonejs/nifti-volume-loader';
import { COLOR_LUT } from 'tools/src/constants';

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

const { createCameraPositionSynchronizer, createVOISynchronizer } =
  synchronizers;

let renderingEngine;

const renderingEngineId = 'myRenderingEngine';
const volumeLoaderScheme = 'cornerstoneStreamingImageVolume'; // author:定义要使用的Volume加载器的加载器ID

var queryString = window.location.search;
var urlParams = new URLSearchParams(queryString);
var fileName = urlParams.get('file');

const inputURL = require('$nifits/'+fileName);
const resultURL = require('$nifits/result'+fileName);


const inputVolumeId = `nifti:${inputURL}`; // VolumeId with loader id + volume id

const resultVolumeId = `nifti:${resultURL}`;
const ctToolGroupId = 'CT_TOOLGROUP_ID';
const ptToolGroupId = 'PT_TOOLGROUP_ID';
const fusionToolGroupId = 'FUSION_TOOLGROUP_ID';
const mipToolGroupUID = 'MIP_TOOLGROUP_ID';

let ctVolume;
let ptVolume;
const axialCameraSynchronizerId = 'AXIAL_CAMERA_SYNCHRONIZER_ID';
const sagittalCameraSynchronizerId = 'SAGITTAL_CAMERA_SYNCHRONIZER_ID';
const coronalCameraSynchronizerId = 'CORONAL_CAMERA_SYNCHRONIZER_ID';
const ctVoiSynchronizerId = 'CT_VOI_SYNCHRONIZER_ID';
const ptVoiSynchronizerId = 'PT_VOI_SYNCHRONIZER_ID';
let axialCameraPositionSynchronizer;
let sagittalCameraPositionSynchronizer;
let coronalCameraPositionSynchronizer;
let ctVoiSynchronizer;
let ptVoiSynchronizer;
let mipToolGroup;
const viewportIds = {
  CT: { AXIAL: 'CT_AXIAL', SAGITTAL: 'CT_SAGITTAL', CORONAL: 'CT_CORONAL' },
  PT: { AXIAL: 'PT_AXIAL', SAGITTAL: 'PT_SAGITTAL', CORONAL: 'PT_CORONAL' },
  FUSION: {
    AXIAL: 'FUSION_AXIAL',
    SAGITTAL: 'FUSION_SAGITTAL',
    CORONAL: 'FUSION_CORONAL',
  },
  PETMIP: {
    CORONAL: 'PET_MIP_CORONAL',
  },
};

//设置标题和描述
setTitleAndDescription(
  '冠状动脉分割结果展示',
  '第一行 原图像 | 第二行 冠状动脉 | 第三行 叠加图 |\n\n当前左键功能：'
);

const optionsValues = [CrosshairsTool.toolName, WindowLevelTool.toolName, ];

// ============================= //
// 添加选择框用来控制左键功能
addDropdownToToolbar({
  options: { values: optionsValues, defaultValue: CrosshairsTool.toolName },
  onSelectedValueChange: (toolNameAsStringOrNumber) => {
    const toolName = String(toolNameAsStringOrNumber);

    [ctToolGroupId, ptToolGroupId, fusionToolGroupId].forEach((toolGroupId) => {
      const toolGroup = ToolGroupManager.getToolGroup(toolGroupId);
      
      //将其他工具设置为禁用，这样就不会发生冲突。
      //注意，我们只需要改变当前活动的一个。

      if (toolName === WindowLevelTool.toolName) {
        //将十字线设置为被动，这样它们仍然是可交互的
        toolGroup.setToolPassive(CrosshairsTool.toolName);
        toolGroup.setToolActive(WindowLevelTool.toolName, {
          bindings: [{ mouseButton: MouseBindings.Primary }],
        });
      } else {
        toolGroup.setToolDisabled(WindowLevelTool.toolName);
        toolGroup.setToolActive(CrosshairsTool.toolName, {
          bindings: [{ mouseButton: MouseBindings.Primary }],
        });
      }
    });
  },
});

//重新调整大小
const resizeObserver = new ResizeObserver(() => {
  console.log('Size changed');

  renderingEngine = getRenderingEngine(renderingEngineId);

  if (renderingEngine) {
    renderingEngine.resize(true, false);
  }
});

//新建html元素：viewport矩阵
const viewportGrid = document.createElement('div');

//设置矩阵尺寸
viewportGrid.style.display = 'grid';
viewportGrid.style.gridTemplateRows = `[row1-start] 33% [row2-start] 33% [row3-start] 33% [end]`;
viewportGrid.style.gridTemplateColumns = `[col1-start] 20% [col2-start] 20% [col3-start] 20% [col4-start] 20% [col5-start] 20%[end]`;
viewportGrid.style.width = '95vw';
viewportGrid.style.height = '80vh';

const content = document.getElementById('content');

//绑定到contenet上
content.appendChild(viewportGrid);

//新建九宫格视窗元素以及右侧立体div
const element1_1 = document.createElement('div');
const element1_2 = document.createElement('div');
const element1_3 = document.createElement('div');
const element2_1 = document.createElement('div');
const element2_2 = document.createElement('div');
const element2_3 = document.createElement('div');
const element3_1 = document.createElement('div');
const element3_2 = document.createElement('div');
const element3_3 = document.createElement('div');
const element_mip = document.createElement('div');

// 放置主要的 3x3 视窗
element1_1.style.gridColumnStart = '1';
element1_1.style.gridRowStart = '1';
element1_2.style.gridColumnStart = '2';
element1_2.style.gridRowStart = '1';
element1_3.style.gridColumnStart = '3';
element1_3.style.gridRowStart = '1';
element2_1.style.gridColumnStart = '1';
element2_1.style.gridRowStart = '2';
element2_2.style.gridColumnStart = '2';
element2_2.style.gridRowStart = '2';
element2_3.style.gridColumnStart = '3';
element2_3.style.gridRowStart = '2';
element3_1.style.gridColumnStart = '1';
element3_1.style.gridRowStart = '3';
element3_2.style.gridColumnStart = '2';
element3_2.style.gridRowStart = '3';
element3_3.style.gridColumnStart = '3';
element3_3.style.gridRowStart = '3';

// 放置 MIP 视窗
element_mip.style.gridColumnStart = '4';
element_mip.style.gridRowStart = '1';
element_mip.style.gridRowEnd = 'span 3';

viewportGrid.appendChild(element1_1);
viewportGrid.appendChild(element1_2);
viewportGrid.appendChild(element1_3);
viewportGrid.appendChild(element2_1);
viewportGrid.appendChild(element2_2);
viewportGrid.appendChild(element2_3);
viewportGrid.appendChild(element3_1);
viewportGrid.appendChild(element3_2);
viewportGrid.appendChild(element3_3);
viewportGrid.appendChild(element_mip);

const elements = [
  element1_1,
  element1_2,
  element1_3,
  element2_1,
  element2_2,
  element2_3,
  element3_1,
  element3_2,
  element3_3,
];

elements.forEach((element) => {
  element.style.width = '100%';
  element.style.height = '100%';

  // 禁用右键单击上下文菜单，以便我们可以有右键单击工具
  element.oncontextmenu = (e) => e.preventDefault();

  resizeObserver.observe(element);
});

element_mip.style.width = '100%';
element_mip.style.height = '100%';
element_mip.oncontextmenu = (e) => e.preventDefault();
resizeObserver.observe(element_mip);

const instructions = document.createElement('p');

instructions.innerText = `
  控制方式:
  - 左键: 使用工具
  - 中键点击: 平移
  - 右键点击: 缩放
  - 中键滚轮: 沿轴滚动

  Window Level工具:
  - 左键：设置所有图像的窗位（Window Level)

  Crosshairs:
  - 左键点击设置十字准线位置 
  - 拖动参照线可以移动十字准线，并同步滚动其他视图。
  - 厚度调整点 (较近于十字线中心): 拖动可以更改该平面中横切片的厚度。
  - 角度调整点 (较远于十字线中心): 拖动可以旋转轴的角度。

  PET MIP:
  - 鼠标滚轮: 旋转
  - 左键点击: 将所有视图跳转到点击区域中最高SUV的点。

  3D体积图操作:
  - 中键点击、拖动 : 旋转图像
  - 鼠标滚轮点击: 旋转
  - 右键 : 平移
  - 左键点击: 将所有视图跳转到点击区域中最高SUV的点。
  `;

instructions.style.gridColumnStart = '5';
instructions.style.gridRowStart = '1';
instructions.style.gridRowEnd = 'span 3';

viewportGrid.append(instructions);

// ============================= //

const viewportColors = {
  [viewportIds.CT.AXIAL]: 'rgb(200, 0, 0)',
  [viewportIds.CT.SAGITTAL]: 'rgb(200, 200, 0)',
  [viewportIds.CT.CORONAL]: 'rgb(0, 200, 0)',
  [viewportIds.PT.AXIAL]: 'rgb(200, 0, 0)',
  [viewportIds.PT.SAGITTAL]: 'rgb(200, 200, 0)',
  [viewportIds.PT.CORONAL]: 'rgb(0, 200, 0)',
  [viewportIds.FUSION.AXIAL]: 'rgb(200, 0, 0)',
  [viewportIds.FUSION.SAGITTAL]: 'rgb(200, 200, 0)',
  [viewportIds.FUSION.CORONAL]: 'rgb(0, 200, 0)',
};

const viewportReferenceLineControllable = [
  viewportIds.CT.AXIAL,
  viewportIds.CT.SAGITTAL,
  viewportIds.CT.CORONAL,
  viewportIds.PT.AXIAL,
  viewportIds.PT.SAGITTAL,
  viewportIds.PT.CORONAL,
  viewportIds.FUSION.AXIAL,
  viewportIds.FUSION.SAGITTAL,
  viewportIds.FUSION.CORONAL,
];

const viewportReferenceLineDraggableRotatable = [
  viewportIds.CT.AXIAL,
  viewportIds.CT.SAGITTAL,
  viewportIds.CT.CORONAL,
  viewportIds.PT.AXIAL,
  viewportIds.PT.SAGITTAL,
  viewportIds.PT.CORONAL,
  viewportIds.FUSION.AXIAL,
  viewportIds.FUSION.SAGITTAL,
  viewportIds.FUSION.CORONAL,
];

const viewportReferenceLineSlabThicknessControlsOn = [
  viewportIds.CT.AXIAL,
  viewportIds.CT.SAGITTAL,
  viewportIds.CT.CORONAL,
  viewportIds.PT.AXIAL,
  viewportIds.PT.SAGITTAL,
  viewportIds.PT.CORONAL,
  viewportIds.FUSION.AXIAL,
  viewportIds.FUSION.SAGITTAL,
  viewportIds.FUSION.CORONAL,
];

function getReferenceLineColor(viewportId) {
  return viewportColors[viewportId];
}

function getReferenceLineControllable(viewportId) {
  const index = viewportReferenceLineControllable.indexOf(viewportId);
  return index !== -1;
}

function getReferenceLineDraggableRotatable(viewportId) {
  const index = viewportReferenceLineDraggableRotatable.indexOf(viewportId);
  return index !== -1;
}

function getReferenceLineSlabThicknessControlsOn(viewportId) {
  const index =
    viewportReferenceLineSlabThicknessControlsOn.indexOf(viewportId);
  return index !== -1;
}

function setUpToolGroups() {
  // 添加工具
  cornerstoneTools.addTool(WindowLevelTool);
  cornerstoneTools.addTool(PanTool);
  cornerstoneTools.addTool(ZoomTool);
  cornerstoneTools.addTool(StackScrollMouseWheelTool);
  cornerstoneTools.addTool(MIPJumpToClickTool);
  cornerstoneTools.addTool(VolumeRotateMouseWheelTool);
  cornerstoneTools.addTool(CrosshairsTool);
  cornerstoneTools.addTool(TrackballRotateTool);

  //定义9个主要视口的工具组。
  //十字线目前只支持一个工具组的3个视口，因为
  //它的构造方式，但它的配置输入允许我们同步
  //多组3个viewport。
  const ctToolGroup = ToolGroupManager.createToolGroup(ctToolGroupId);
  const ptToolGroup = ToolGroupManager.createToolGroup(ptToolGroupId);
  const fusionToolGroup = ToolGroupManager.createToolGroup(fusionToolGroupId);

  ctToolGroup.addViewport(viewportIds.CT.AXIAL, renderingEngineId);
  ctToolGroup.addViewport(viewportIds.CT.SAGITTAL, renderingEngineId);
  ctToolGroup.addViewport(viewportIds.CT.CORONAL, renderingEngineId);
  ptToolGroup.addViewport(viewportIds.PT.AXIAL, renderingEngineId);
  ptToolGroup.addViewport(viewportIds.PT.SAGITTAL, renderingEngineId);
  ptToolGroup.addViewport(viewportIds.PT.CORONAL, renderingEngineId);
  fusionToolGroup.addViewport(viewportIds.FUSION.AXIAL, renderingEngineId);
  fusionToolGroup.addViewport(viewportIds.FUSION.SAGITTAL, renderingEngineId);
  fusionToolGroup.addViewport(viewportIds.FUSION.CORONAL, renderingEngineId);

  // 操纵工具
  [ctToolGroup, ptToolGroup].forEach((toolGroup) => {
    toolGroup.addTool(PanTool.toolName);
    toolGroup.addTool(ZoomTool.toolName);
    toolGroup.addTool(StackScrollMouseWheelTool.toolName);
    toolGroup.addTool(CrosshairsTool.toolName, {
      getReferenceLineColor,
      getReferenceLineControllable,
      getReferenceLineDraggableRotatable,
      getReferenceLineSlabThicknessControlsOn,
    });
  });

  fusionToolGroup.addTool(PanTool.toolName);
  fusionToolGroup.addTool(ZoomTool.toolName);
  fusionToolGroup.addTool(StackScrollMouseWheelTool.toolName);
  fusionToolGroup.addTool(CrosshairsTool.toolName, {
    getReferenceLineColor,
    getReferenceLineControllable,
    getReferenceLineDraggableRotatable,
    getReferenceLineSlabThicknessControlsOn,
    //仅在融合视口中将CT体积设置为MIP
    filterActorUIDsToSetSlabThickness: [inputVolumeId],
  });

  //这里是使用的工具组的区别，我们需要指定
  //用于融合视口的WindowLevelTool的volumnId
  ctToolGroup.addTool(WindowLevelTool.toolName);
  ptToolGroup.addTool(WindowLevelTool.toolName);
  fusionToolGroup.addTool(WindowLevelTool.toolName, {
    volumeId: resultVolumeId,
  });

  [ctToolGroup, ptToolGroup, fusionToolGroup].forEach((toolGroup) => {
    toolGroup.setToolActive(WindowLevelTool.toolName, {
      bindings: [
        {
          mouseButton: MouseBindings.Primary, // 左键
        },
      ],
    });
    toolGroup.setToolActive(PanTool.toolName, {
      bindings: [
        {
          mouseButton: MouseBindings.Auxiliary, // 中键
        },
      ],
    });
    toolGroup.setToolActive(ZoomTool.toolName, {
      bindings: [
        {
          mouseButton: MouseBindings.Secondary, // 右键
        },
      ],
    });

    toolGroup.setToolActive(StackScrollMouseWheelTool.toolName);
    toolGroup.setToolDisabled(WindowLevelTool.toolName);
    toolGroup.setToolActive(CrosshairsTool.toolName, {
      bindings: [{ mouseButton: MouseBindings.Primary }],
    });
  });

  // MIP Tool Groups
  mipToolGroup = ToolGroupManager.createToolGroup(mipToolGroupUID);
  mipToolGroup.addTool('VolumeRotateMouseWheel');
  mipToolGroup.addTool('MIPJumpToClickTool', {
    toolGroupId: ptToolGroupId,
  });

  // Set the initial state of the tools, here we set one tool active on left click.
  // This means left click will draw that tool.
  mipToolGroup.setToolActive('MIPJumpToClickTool', {
    bindings: [
      {
        mouseButton: MouseBindings.Primary, // Left Click
      },
    ],
  });
  // As the Stack Scroll mouse wheel is a tool using the `mouseWheelCallback`
  // hook instead of mouse buttons, it does not need to assign any mouse button.
  mipToolGroup.setToolActive('VolumeRotateMouseWheel');

  mipToolGroup.addViewport(viewportIds.PETMIP.CORONAL, renderingEngineId);
}

//设置同步器
function setUpSynchronizers() {
  axialCameraPositionSynchronizer = createCameraPositionSynchronizer(
    axialCameraSynchronizerId
  );
  sagittalCameraPositionSynchronizer = createCameraPositionSynchronizer(
    sagittalCameraSynchronizerId
  );
  coronalCameraPositionSynchronizer = createCameraPositionSynchronizer(
    coronalCameraSynchronizerId
  );
  ctVoiSynchronizer = createVOISynchronizer(ctVoiSynchronizerId);
  ptVoiSynchronizer = createVOISynchronizer(ptVoiSynchronizerId);
  // Add viewports to camera synchronizers
  [
    viewportIds.CT.AXIAL,
    viewportIds.PT.AXIAL,
    viewportIds.FUSION.AXIAL,
  ].forEach((viewportId) => {
    axialCameraPositionSynchronizer.add({
      renderingEngineId,
      viewportId,
    });
  });
  [
    viewportIds.CT.SAGITTAL,
    viewportIds.PT.SAGITTAL,
    viewportIds.FUSION.SAGITTAL,
  ].forEach((viewportId) => {
    sagittalCameraPositionSynchronizer.add({
      renderingEngineId,
      viewportId,
    });
  });
  [
    viewportIds.CT.CORONAL,
    viewportIds.PT.CORONAL,
    viewportIds.FUSION.CORONAL,
  ].forEach((viewportId) => {
    coronalCameraPositionSynchronizer.add({
      renderingEngineId,
      viewportId,
    });
  });

  // Add viewports to VOI synchronizers
  [
    viewportIds.CT.AXIAL,
    viewportIds.CT.SAGITTAL,
    viewportIds.CT.CORONAL,
  ].forEach((viewportId) => {
    ctVoiSynchronizer.add({
      renderingEngineId,
      viewportId,
    });
  });
  [
    viewportIds.FUSION.AXIAL,
    viewportIds.FUSION.SAGITTAL,
    viewportIds.FUSION.CORONAL,
  ].forEach((viewportId) => {
    // In this example, the fusion viewports are only targets for CT VOI
    // synchronization, not sources
    ctVoiSynchronizer.addTarget({
      renderingEngineId,
      viewportId,
    });
  });
  [
    viewportIds.PT.AXIAL,
    viewportIds.PT.SAGITTAL,
    viewportIds.PT.CORONAL,
    viewportIds.FUSION.AXIAL,
    viewportIds.FUSION.SAGITTAL,
    viewportIds.FUSION.CORONAL,
    viewportIds.PETMIP.CORONAL,
  ].forEach((viewportId) => {
    ptVoiSynchronizer.add({
      renderingEngineId,
      viewportId,
    });
  });
}

async function setUpDisplay() {
  // 创建视窗

  const viewportInputArray = [
    {
      viewportId: viewportIds.CT.AXIAL,
      type: ViewportType.ORTHOGRAPHIC,
      element: element1_1,
      defaultOptions: {
        orientation: Enums.OrientationAxis.AXIAL,
      },
    },
    {
      viewportId: viewportIds.CT.SAGITTAL,
      type: ViewportType.ORTHOGRAPHIC,
      element: element1_2,
      defaultOptions: {
        orientation: Enums.OrientationAxis.SAGITTAL,
      },
    },
    {
      viewportId: viewportIds.CT.CORONAL,
      type: ViewportType.ORTHOGRAPHIC,
      element: element1_3,
      defaultOptions: {
        orientation: Enums.OrientationAxis.CORONAL,
      },
    },
    {
      viewportId: viewportIds.PT.AXIAL,
      type: ViewportType.ORTHOGRAPHIC,
      element: element2_1,
      defaultOptions: {
        orientation: Enums.OrientationAxis.AXIAL,
        background: <Types.Point3>[1, 1, 1],
      },
    },
    {
      viewportId: viewportIds.PT.SAGITTAL,
      type: ViewportType.ORTHOGRAPHIC,
      element: element2_2,
      defaultOptions: {
        orientation: Enums.OrientationAxis.SAGITTAL,
        background: <Types.Point3>[1, 1, 1],
      },
    },
    {
      viewportId: viewportIds.PT.CORONAL,
      type: ViewportType.ORTHOGRAPHIC,
      element: element2_3,
      defaultOptions: {
        orientation: Enums.OrientationAxis.CORONAL,
        background: <Types.Point3>[1, 1, 1],
      },
    },
    {
      viewportId: viewportIds.FUSION.AXIAL,
      type: ViewportType.ORTHOGRAPHIC,
      element: element3_1,
      defaultOptions: {
        orientation: Enums.OrientationAxis.AXIAL,
      },
    },
    {
      viewportId: viewportIds.FUSION.SAGITTAL,
      type: ViewportType.ORTHOGRAPHIC,
      element: element3_2,
      defaultOptions: {
        orientation: Enums.OrientationAxis.SAGITTAL,
      },
    },
    {
      viewportId: viewportIds.FUSION.CORONAL,
      type: ViewportType.ORTHOGRAPHIC,
      element: element3_3,
      defaultOptions: {
        orientation: Enums.OrientationAxis.CORONAL,
      },
    },
    {
      viewportId: viewportIds.PETMIP.CORONAL,
      type: ViewportType.ORTHOGRAPHIC,
      element: element_mip,
      defaultOptions: {
        orientation: Enums.OrientationAxis.CORONAL,
        background: <Types.Point3>[1, 1, 1],
      },
    },
  ];

  renderingEngine.setViewports(viewportInputArray);

  // volumes读取
  ptVolume.load();
  ctVolume.load();

  // volumes绑定到视窗
  await setVolumesForViewports(
    renderingEngine,
    [
      {
        volumeId: inputVolumeId,
        callback: setCtTransferFunctionForVolumeActor,
      },
    ],
    [viewportIds.CT.AXIAL, viewportIds.CT.SAGITTAL, viewportIds.CT.CORONAL]
  );
  

  await setVolumesForViewports(
    renderingEngine,
    [
      {
        volumeId: resultVolumeId,
        callback: setPetColorMapTransferFunctionForVolumeActor,
      },
    ],
    [viewportIds.PT.AXIAL, viewportIds.PT.SAGITTAL, viewportIds.PT.CORONAL]
  );

  await setVolumesForViewports(
    renderingEngine,
    [
      {
        volumeId: inputVolumeId,
        callback: setCtTransferFunctionForVolumeActor,
      },
      {
        volumeId: resultVolumeId,
        callback: setPetColorMapTransferFunctionForVolumeActor,
      },
    ],
    [
      viewportIds.FUSION.AXIAL,
      viewportIds.FUSION.SAGITTAL,
      viewportIds.FUSION.CORONAL,
    ]
  );

  // 计算mip的大小
  const ptVolumeDimensions = ptVolume.dimensions;

  // 只需要使MIP尽可能大。
  const slabThickness = Math.sqrt(
    ptVolumeDimensions[0] * ptVolumeDimensions[0] +
      ptVolumeDimensions[1] * ptVolumeDimensions[1] +
      ptVolumeDimensions[2] * ptVolumeDimensions[2]
  );

  setVolumesForViewports(
    renderingEngine,
    [
      {
        volumeId: resultVolumeId,
        callback: setPetColorMapTransferFunctionForVolumeActor,
        blendMode: BlendModes.MAXIMUM_INTENSITY_BLEND,
        slabThickness,
      },
    ],
    [viewportIds.PETMIP.CORONAL]
  );

  initializeCameraSync(renderingEngine);

  // Render the viewports
  renderingEngine.render();
}

addButtonToToolbar({
  title: '更新3D体积图',
  onClick: async () => {
    const viewportInput = {
      viewportId: viewportIds.PETMIP.CORONAL,
      type: ViewportType.VOLUME_3D,
      element: element_mip,
      defaultOptions: {
        orientation: Enums.OrientationAxis.CORONAL,
        background: <Types.Point3>[1, 1, 1],
      },
    };
    const volume3dToolGroup = mipToolGroup;
    toggleVolume(viewportInput);
    setupVolume3dSynchronizer(viewportInput);
    setUpVolume3dToolGroup(volume3dToolGroup);
    
    renderingEngine.render();
  },
});

function toggleVolume(viewportInput) {
  renderingEngine.enableElement(viewportInput);

  const viewport = <Types.IVolumeViewport>(
    renderingEngine.getViewport(viewportIds.PETMIP.CORONAL)
  );

  const ptVolumeDimensions = ptVolume.dimensions;

  // Only make the MIP as large as it needs to be.
  const slabThickness = Math.sqrt(
    ptVolumeDimensions[0] * ptVolumeDimensions[0] +
      ptVolumeDimensions[1] * ptVolumeDimensions[1] +
      ptVolumeDimensions[2] * ptVolumeDimensions[2]
  );

  viewport.setVolumes([
    {
      volumeId: resultVolumeId,
      callback: setPetColorMapTransferFunctionForVolumeActor,
      slabThickness: slabThickness,
      blendMode: BlendModes.MAXIMUM_INTENSITY_BLEND,
    },
  ]);
}
function setupVolume3dSynchronizer(viewportInput) {
  ptVoiSynchronizer.addTarget({
    renderingEngineId,
    viewportId: viewportInput.viewportId,
  });
}
function setUpVolume3dToolGroup(toolGroup) {
  toolGroup.addTool(PanTool.toolName);
  toolGroup.addTool(TrackballRotateTool.toolName);

  toolGroup.setToolActive(PanTool.toolName, {
    bindings: [
      {
        mouseButton: MouseBindings.Secondary,
      },
    ],
  });
  toolGroup.setToolActive(TrackballRotateTool.toolName, {
    bindings: [
      {
        mouseButton: MouseBindings.Auxiliary,
      },
    ],
  });
  toolGroup.addViewport(viewportIds.PETMIP.CORONAL, renderingEngineId);
}
function initializeCameraSync(renderingEngine) {
  // The fusion scene is the target as it is scaled to both volumes.
  // TODO -> We should have a more generic way to do this,
  // So that when all data is added we can synchronize zoom/position before interaction.

  const axialCtViewport = renderingEngine.getViewport(viewportIds.CT.AXIAL);
  const sagittalCtViewport = renderingEngine.getViewport(
    viewportIds.CT.SAGITTAL
  );
  const coronalCtViewport = renderingEngine.getViewport(viewportIds.CT.CORONAL);

  const axialPtViewport = renderingEngine.getViewport(viewportIds.PT.AXIAL);
  const sagittalPtViewport = renderingEngine.getViewport(
    viewportIds.PT.SAGITTAL
  );
  const coronalPtViewport = renderingEngine.getViewport(viewportIds.PT.CORONAL);

  const axialFusionViewport = renderingEngine.getViewport(
    viewportIds.FUSION.AXIAL
  );
  const sagittalFusionViewport = renderingEngine.getViewport(
    viewportIds.FUSION.SAGITTAL
  );
  const coronalFusionViewport = renderingEngine.getViewport(
    viewportIds.FUSION.CORONAL
  );

  initCameraSynchronization(axialFusionViewport, axialCtViewport);
  initCameraSynchronization(axialFusionViewport, axialPtViewport);

  initCameraSynchronization(sagittalFusionViewport, sagittalCtViewport);
  initCameraSynchronization(sagittalFusionViewport, sagittalPtViewport);

  initCameraSynchronization(coronalFusionViewport, coronalCtViewport);
  initCameraSynchronization(coronalFusionViewport, coronalPtViewport);

  renderingEngine.render();
}

function initCameraSynchronization(sViewport, tViewport) {
  // Initialise the sync as they viewports will have
  // Different initial zoom levels for viewports of different sizes.

  const camera = sViewport.getCamera();

  tViewport.setCamera(camera);
}

/**
 * Runs the demo
 */
async function run() {
  // Init Cornerstone and related libraries
  await initDemo();

  volumeLoader.registerVolumeLoader(
    "nifti",
    cornerstoneNiftiImageVolumeLoader
  );
  //关闭鼠标中键作用
  document.addEventListener('mousedown', function(event) {
    if (event.button === 1) {
        event.preventDefault();
    }
  });
  // Instantiate a rendering engine
  renderingEngine = new RenderingEngine(renderingEngineId);
  // Define a volume in memory
  ctVolume = await volumeLoader.createAndCacheVolume(inputVolumeId);
  // Define a volume in memory
  ptVolume = await volumeLoader.createAndCacheVolume(resultVolumeId);

  // Display needs to be set up first so that we have viewport to reference for tools and synchronizers.
  await setUpDisplay();

  // Tools and synchronizers can be set up in any order.
  setUpToolGroups();
  setUpSynchronizers();
}

run();
