const saveAnalysisInfo = async function ({info, analysis_data_endpoint_url}) {
    const response = await fetch(analysis_data_endpoint_url, {
        method: "POST",
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        mode: "cors",
        cache: "no-cache",
        body: JSON.stringify(info)
    });
    console.log(response);
    return response;
};


const updateStatus = function (projectId, task, status) {
    // send message back readyForNext
    window.parent.postMessage({
        project_id: projectId,
        task: task,
        status: status
    }, '*');
};

const loadProjectAndRunTask = function (projectInputId, wsReadyCallback) {
    if(projectInputId===undefined){
        throw new Exception("execution request for undefined project id");
    }

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

    Project.ID = Scratch.vm.downloadProjectId(projectInputId);
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