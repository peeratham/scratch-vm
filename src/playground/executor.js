window.onhashchange = function () {
    location.reload();
};

const idDom = document.getElementById("projectId");
let currentProjectId;
const ASSET_SERVER = 'https://cdn.assets.scratch.mit.edu/';
const PROJECT_SERVER = 'https://cdn.projects.scratch.mit.edu/';

/**
 * @param {Asset} asset - calculate a URL for this asset.
 * @returns {string} a URL to download a project file.
 */
const getProjectUrl = function (asset) {
    const assetIdParts = asset.assetId.split('.');
    const assetUrlParts = [PROJECT_SERVER, 'internalapi/project/', assetIdParts[0], '/get/'];
    if (assetIdParts[1]) {
        assetUrlParts.push(assetIdParts[1]);
    }
    return assetUrlParts.join('');
};

/**
 * @param {Asset} asset - calculate a URL for this asset.
 * @returns {string} a URL to download a project asset (PNG, WAV, etc.)
 */
const getAssetUrl = function (asset) {
    const assetUrlParts = [
        ASSET_SERVER,
        'internalapi/asset/',
        asset.assetId,
        '.',
        asset.dataFormat,
        '/get/'
    ];
    return assetUrlParts.join('');
};

const serverUrl = 'http://localhost:3000/project-data'; 
const sendReqToSave = async function(projectId, sb3File, xml){
    var formData  = new FormData();
    formData.append('name', projectId);
    formData.append('sb3', sb3File);
    formData.append('xml', xml);
    const response = await fetch(serverUrl, { 
        method: "POST", 
        mode: "cors", 
        cache: "no-cache", 
        body: formData    
    });
    console.log(response);
    return response;
};

const autoDownload = async function(){ 
    const downloadLink = document.createElement('a'); 
    document.body.appendChild(downloadLink);
    const xml = await new Promise(function (resolve, reject) {
        resolve(getProgramXml());
    });
    Scratch.vm.saveProjectSb3().then(content => { 
        const url = window.URL.createObjectURL(content); 
            downloadLink.href = url; 
            downloadLink.download = "filename"; 
            return sendReqToSave(currentProjectId, content, xml);
    }).then(()=>{
        // send message back readyForNext
        window.parent.postMessage({
            type: 'NEXT',
            project_id: currentProjectId
        }, '*');    
    }); 
}; 

const sendProjectSaveReq = function(){
    autoDownload();
}


window.onload = function(){
    currentProjectId = idDom.innerText = location.hash.substring(1,location.hash.length);
    setupScratchBlocksVM(currentProjectId, sendProjectSaveReq);
}

const setupScratchBlocksVM = function (projectInputId, wsReadyCallback) {
    const vm = new window.VirtualMachine();
    Scratch.vm = vm;
    let firstTimeWorkspaceUpdate = true;

    vm.on('workspaceUpdate', data => {
        if (Scratch.vm.runtime._blockInfo.length > 0) {
            Blockly.defineBlocksWithJsonArray(Scratch.vm.runtime._blockInfo[0].blocks.map(blockInfo => blockInfo.json).filter(x => x));
        }
        workspace.clear();
        Blockly.Events.recordUndo = false;
        const dom = window.Blockly.Xml.textToDom(data.xml);
        window.Blockly.Xml.domToWorkspace(dom, workspace);
        if (firstTimeWorkspaceUpdate) {
            firstTimeWorkspaceUpdate = false;
            vm.emit('workspaceReady', data);
        }
    });

    const workspace = window.Blockly.inject('blocks', {
        comments: true,
        disable: false,
        collapse: false,
        media: '../playground/media/',
        readOnly: true,
        scrollbars: true,
        sounds: true,
        zoom: {
            controls: true,
            wheel: true,
            startScale: 0.6,
            maxScale: 4,
            minScale: 0.25,
            scaleSpeed: 1.1
        },
        colours: {
            fieldShadow: 'rgba(255, 255, 255, 0.3)',
            dragShadowOpacity: 0.6
        }
    });
    Scratch.workspace = workspace;

    //connect workspace to vm
    Scratch.workspace.addChangeListener(Scratch.vm.blockListener);
    Scratch.workspace.addChangeListener(Scratch.vm.variableListener);
    Scratch.vm.setTurboMode(false);  //turbo

    const storage = new ScratchStorage(); /* global ScratchStorage */
    const AssetType = storage.AssetType;

    storage.addWebSource([AssetType.Project], getProjectUrl);
    storage.addWebSource([AssetType.ImageVector, AssetType.ImageBitmap, AssetType.Sound], getAssetUrl);
    Scratch.vm.attachStorage(storage);

    const projectId = Project.ID = Scratch.vm.downloadProjectId(projectInputId);
    Scratch.vm.on('workspaceReady', async (data) => {
        await wsReadyCallback();
    });
    // Instantiate the renderer and connect it to the VM.
    const canvas = document.getElementById('scratch-stage');
    const renderer = new window.ScratchRender(canvas);
    Scratch.renderer = renderer;
    vm.attachRenderer(renderer);
    const audioEngine = new window.AudioEngine();
    vm.attachAudioEngine(audioEngine);
    /* global ScratchSVGRenderer */
    vm.attachV2SVGAdapter(new ScratchSVGRenderer.SVGRenderer());
    vm.attachV2BitmapAdapter(new ScratchSVGRenderer.BitmapAdapter());
    // Run threads
    vm.start();
}