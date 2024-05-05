import {RenderingEngine} from './cornerstone3D/packages/core/src/index.ts'

const element = document.getElementById('content');
if(element != null){
    element.style.width = '500px';
    element.style.height = '500px';
}

const renderingEngineId = 'myRenderingEngine';
const renderingEngine = new RenderingEngine(renderingEngineId);