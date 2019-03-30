const serverUrl = 'http://localhost:3000/project-data';

window.onhashchange = function () {
    location.reload();
};

window.onload = function () {
    window.Project = window.Project || {};
    window.Scratch = window.Scratch || {};

    const projectIdDom = document.getElementById("projectId");
    let projectId = projectIdDom.innerText = location.hash.substring(1, location.hash.length);
    if(!projectId){
        console.error("Invalid URL request!", "The URL should be in this format: http://0.0.0.0:8073/playground/data-collect.html#279580169");
        return;
    }
    // let projectId = '279580169';
    loadProjectAndRunTask({
        projectId,
        wsReadyCallback: createUploadTask(projectId, function () { 
            console.log('saved to database!');
            updateStatus(projectId, 'COMPLETE');
        }),
        requiredAnalysisUi:false
    });
};

const updateStatus = function (projectId, status) {
    // send message back readyForNext
    window.parent.postMessage({
        project_id: projectId,
        status: status
    }, '*');
};


const setupScratch = async function (wsReadyCallback) {
    const vm = new window.VirtualMachine();
    Scratch.vm = vm;

    let firstTimeWorkspaceUpdate = true;

    // Receipt of new block XML for the selected target.
    // workspaceUpdate after targetUpdate
    vm.on('workspaceUpdate', data => {
        //define extension blocks
        //todo: future don't define if already exists
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
        readOnly: false,
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
    const flyoutWorkspace = Scratch.workspace.getFlyout().getWorkspace();
    flyoutWorkspace.addChangeListener(Scratch.vm.flyoutBlockListener);
    flyoutWorkspace.addChangeListener(Scratch.vm.monitorBlockListener);

    Scratch.vm.setTurboMode(false);  //turbo

    const storage = new ScratchStorage(); /* global ScratchStorage */
    const AssetType = storage.AssetType;

    storage.addWebSource([AssetType.Project], getOfficialProjectUrl);
    storage.addWebSource([AssetType.ImageVector, AssetType.ImageBitmap, AssetType.Sound], getOfficialAssetUrl);
    Scratch.vm.attachStorage(storage);

  



    if (location.hash) {
        const split = location.hash.substring(1).split(',');
        if (split[1] && split[1].length > 0) {
            warmUpTime = Number(split[1]);
        }
        maxRecordedTime = Number(split[2] || '0') || 6000;
    }


   
    const projectId = Project.ID = loadProject(null);


    Scratch.vm.on('workspaceReady', data => {
        wsReadyCallback();
        //         let evaluator = new RefactoringEvaluator(projectId, data, manualMode, resultDiv);
        //         evaluator.runAll();
        
    });

    Scratch.vm.on('targetsUpdate', data => {
        
        
    });


    // xml text box
    if (sessionStorage) {
        // Restore previously displayed text.
        var text = sessionStorage.getItem('textarea');
        if (text) {
            document.getElementById('importExport').value = text;
        }
    }

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

    // Feed mouse events as VM I/O events.
    document.addEventListener('mousemove', e => {
        const rect = canvas.getBoundingClientRect();
        const coordinates = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            canvasWidth: rect.width,
            canvasHeight: rect.height
        };
        Scratch.vm.postIOData('mouse', coordinates);
    });
    canvas.addEventListener('mousedown', e => {
        const rect = canvas.getBoundingClientRect();
        const data = {
            isDown: true,
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            canvasWidth: rect.width,
            canvasHeight: rect.height
        };
        Scratch.vm.postIOData('mouse', data);
        e.preventDefault();
    });
    canvas.addEventListener('mouseup', e => {
        const rect = canvas.getBoundingClientRect();
        const data = {
            isDown: false,
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            canvasWidth: rect.width,
            canvasHeight: rect.height
        };
        Scratch.vm.postIOData('mouse', data);
        e.preventDefault();
    });

    // Feed keyboard events as VM I/O events.
    document.addEventListener('keydown', e => {
        // Don't capture keys intended for Blockly inputs.
        if (e.target !== document && e.target !== document.body) return;

        Scratch.vm.postIOData('keyboard', {
            keyCode: e.keyCode,
            key: e.key,
            isDown: true
        });
    });
    document.addEventListener('keyup', e => {
        // Always capture up events,
        // even those that have switched to other targets.
        Scratch.vm.postIOData('keyboard', {
            keyCode: e.keyCode,
            key: e.key,
            isDown: false
        });

        // E.g., prevent scroll.
        if (e.target !== document && e.target !== document.body) {
            e.preventDefault();
        }
    });

    // Run threads
    vm.start();
}

const ASSET_SERVER = 'https://assets.scratch.mit.edu/'; 
const PROJECT_SERVER = 'https://projects.scratch.mit.edu/';

/**
 * @param {Asset} asset - calculate a URL for this asset.
 * @returns {string} a URL to download a project file.
 */
const getOfficialProjectUrl = function (asset) {
    const assetIdParts = asset.assetId.split('.');
    const assetUrlParts = [PROJECT_SERVER, assetIdParts[0]]; //https://projects.scratch.mit.edu/279580169
    if (assetIdParts[1]) {
        assetUrlParts.push(assetIdParts[1]);
    }
    let url = assetUrlParts.join('');
    console.log(url);
    return url;
};

/**
 * @param {Asset} asset - calculate a URL for this asset.
 * @returns {string} a URL to download a project asset (PNG, WAV, etc.)
 */
const getOfficialAssetUrl = function (asset) {
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


class LoadingProgress {
    constructor(callback) {
        this.total = 0;
        this.complete = 0;
        this.callback = callback;
    }

    on(storage) {
        const _this = this;
        const _load = storage.webHelper.load;
        storage.webHelper.load = function (...args) {
            const result = _load.call(this, ...args);
            _this.total += 1;
            _this.callback(_this);
            result.then(() => {
                _this.complete += 1;
                _this.callback(_this);
            });
            return result;
        };
    }
}


const loadProject = function (id) {    
    Scratch.vm.downloadProjectId(id); 
};


const loadProjectAndRunTask = function ({providedVM, projectId, wsReadyCallback}) {
    if(projectId===undefined){
        throw new Exception("execution request for undefined project id");
    }

    const vm = providedVM || new window.VirtualMachine();
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
        readOnly: false,
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

    storage.addWebStore([AssetType.Project], getOfficialProjectUrl);
    storage.addWebStore([AssetType.ImageVector, AssetType.ImageBitmap, AssetType.Sound], getOfficialAssetUrl);
    Scratch.vm.attachStorage(storage);

    Project.ID = Scratch.vm.downloadProjectId(projectId);
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
    vm.stopAll();
}

const createUploadTask = function (projectId, callback) {
    return async function () {
        const downloadLink = document.createElement('a');
        document.body.appendChild(downloadLink);
        const xml = await new Promise(function (resolve, reject) {
            resolve(getProgramXml());
        });
        Scratch.vm.saveProjectSb3().then(content => {
            const url = window.URL.createObjectURL(content);
            downloadLink.href = url;
            downloadLink.download = "filename";
            return sendReqToSave(projectId, content, xml);
        }).then(() => callback());
    };
}

const getProgramXml = function () {
    let targets = "";
    const stageVariables = Scratch.vm.runtime.getTargetForStage().variables;
    for (let i = 0; i < Scratch.vm.runtime.targets.length; i++) {
        const currTarget = Scratch.vm.runtime.targets[i];
        const currBlocks = currTarget.blocks._blocks;
        const variableMap = currTarget.variables;
        const variables = Object.keys(variableMap).map(k => variableMap[k]);
        const xmlString = `<${currTarget.isStage ? "stage " : "sprite "} name="${currTarget.getName()}"><xml><variables>${variables.map(v => v.toXML()).join()}</variables>${currTarget.blocks.toXML()}</xml></${currTarget.isStage ? "stage" : "sprite"}>`;

        targets += xmlString;
    }
    var str = `<program>${targets}</program>`;
    str = str.replace(/\s+/g, ' '); // Keep only one space character
    str = str.replace(/>\s*/g, '>');  // Remove space after >
    str = str.replace(/\s*</g, '<');  // Remove space before <

    return str;
}


const sendReqToSave = async function (projectId, sb3File, xml) {
    var formData = new FormData();
    formData.append('_id', projectId);
    formData.append('sb3', sb3File);
    formData.append('xml', xml);
    const response = await fetch(serverUrl, {
        method: "POST",
        mode: "cors",
        cache: "no-cache",
        body: formData
    });

    return response;
};