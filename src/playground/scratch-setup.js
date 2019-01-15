window.onload = function () {
    if (location.hash.substring(1).startsWith('view')) {
        document.body.className = 'render';
        const data = location.hash.substring(6);
        const frozen = atob(data);
        const json = JSON.parse(frozen);
        const { fixture } = json;
        document.querySelector('[type=text]').value = fixture.projectId;
    } else if (location.hash.startsWith("#")) {
        const split = location.hash.substring(1).split(',');
        document.querySelector('[type=text]').value = split[0];
    } else {
        throw new Exception("Unknown data format after #");
    }
    setupScratch(function(){
        if(autoAnalyze){
            autoAnalyzeButton.click();
        }            
    });
    
};

window.onhashchange = function () {
    location.reload();
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

    storage.addWebSource([AssetType.Project], getLocalProjectUrl);
    storage.addWebSource([AssetType.ImageVector, AssetType.ImageBitmap, AssetType.Sound], getLocalAssetUrl);
    Scratch.vm.attachStorage(storage);

    new LoadingProgress(progress => {
        document.getElementsByClassName('loading-total')[0]
            .innerText = progress.total;
        document.getElementsByClassName('loading-complete')[0]
            .innerText = progress.complete;
    }).on(storage);



    if (location.hash) {
        const split = location.hash.substring(1).split(',');
        if (split[1] && split[1].length > 0) {
            warmUpTime = Number(split[1]);
        }
        maxRecordedTime = Number(split[2] || '0') || 6000;
    }


    const resultDiv = document.getElementById('profile-refactoring-result');
    resultDiv.innerHTML = "<table border='0'></table>"

    const projectId = Project.ID = loadProject(projectInput);


    Scratch.vm.on('workspaceReady', data => {
        wsReadyCallback();
        //         let evaluator = new RefactoringEvaluator(projectId, data, manualMode, resultDiv);
        //         evaluator.runAll();
        
    });

    Scratch.vm.on('targetsUpdate', data => {
        // Clear select box.
        while (selectedTarget.firstChild) {
            selectedTarget.removeChild(selectedTarget.firstChild);
        }
        // Generate new select box.
        for (let i = 0; i < data.targetList.length; i++) {
            const targetOption = document.createElement('option');
            targetOption.setAttribute('value', data.targetList[i].id);
            // If target id matches editingTarget id, select it.
            if (data.targetList[i].id === data.editingTarget) {
                targetOption.setAttribute('selected', 'selected');
            }
            targetOption.appendChild(
                document.createTextNode(data.targetList[i].name)
            );
            selectedTarget.appendChild(targetOption);
        }
    });


    // xml text box
    if (sessionStorage) {
        // Restore previously displayed text.
        var text = sessionStorage.getItem('textarea');
        if (text) {
            document.getElementById('importExport').value = text;
        }
        taChange();
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