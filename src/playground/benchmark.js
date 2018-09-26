const Scratch = window.Scratch = window.Scratch || {};

const ASSET_SERVER = 'https://cdn.assets.scratch.mit.edu/';
const PROJECT_SERVER = 'https://cdn.projects.scratch.mit.edu/';


const LOCAL_ASSET_SERVER = 'http://localhost:8000/';
const LOCAL_PROJECT_SERVER = 'http://localhost:8000/';

const SLOW = .1;

const projectInput = document.querySelector('input');



document.querySelector('.run')
    .addEventListener('click', () => {
        window.location.hash = projectInput.value;
        location.reload();
    }, false);

const setShareLink = function (json) {
    document.querySelector('.share')
        .href = `#view/${btoa(JSON.stringify(json))}`;
    document.querySelectorAll('.share')[1]
        .href = `suite.html`;
};

const loadProject = function () {
    let id = location.hash.substring(1).split(',')[0];
    if (id.length < 1 || !isFinite(id)) {
        id = projectInput.value;
    }
    Scratch.vm.downloadProjectId(id);
    return id;
};

const getProgramXml = function () {
        let targets = "";
        const stageVariables = Scratch.vm.runtime.getTargetForStage().variables;
        for (let i = 0; i < Scratch.vm.runtime.targets.length; i++) {
            const currTarget = Scratch.vm.runtime.targets[i];
            const currBlocks = currTarget.blocks._blocks;
            const variableMap = currTarget.variables;
            const variables = Object.keys(variableMap).map(k => variableMap[k]);
            const xmlString = `<${currTarget.isStage? "stage ": "sprite "} name="${currTarget.getName()}"><xml><variables>${variables.map(v => v.toXML()).join()}</variables>${currTarget.blocks.toXML()}</xml></${currTarget.isStage? "stage": "sprite"}>`;
            
            //assembling
            targets += xmlString;
        }
        var str = `<program>${targets}</program>`;
        str = str.replace(/\s+/g, ' '); // Keep only one space character
        str = str.replace(/>\s*/g, '>');  // Remove space after >
        str = str.replace(/\s*</g, '<');  // Remove space before <

        return str;
}

/**
 * @param {Asset} asset - calculate a URL for this asset.
 * @returns {string} a URL to download a project file.
 */
const getProjectUrl = function (asset) {
    const assetIdParts = asset.assetId.split('.');
    const assetUrlParts = [LOCAL_PROJECT_SERVER, 'internalapi/project/', assetIdParts[0], '/get/'];
    if (assetIdParts[1]) {
        assetUrlParts.push(assetIdParts[1]);
    }
    return assetUrlParts.join('');
};


const getLocalProjectUrl = function (asset) {
    const assetIdParts = asset.assetId.split('.');
    const assetUrlParts = [LOCAL_PROJECT_SERVER,assetIdParts[0]+'.sb3_FILES/', 'project.json'];
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

const getLocalAssetUrl = function (asset) {
    const assetUrlParts = [
        LOCAL_ASSET_SERVER,
        location.hash.substring(1).split(",")[0]+'.sb3_FILES/',
        asset.assetId,
        '.',
        asset.dataFormat
    ];
    return assetUrlParts.join('');
};

class LoadingProgress {
    constructor (callback) {
        this.total = 0;
        this.complete = 0;
        this.callback = callback;
    }

    on (storage) {
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

class StatTable {
    constructor ({table, keys, viewOf, isSlow}) {
        this.table = table;
        if (keys) {
            this.keys = keys;
        }
        if (viewOf) {
            this.viewOf = viewOf;
        }
        if (isSlow) {
            this.isSlow = isSlow;
        }
    }

    render () {
        const table = this.table;
        Array.from(table.children)
            .forEach(node => table.removeChild(node));
        const keys = this.keys();
        for (const key of keys) {
            this.viewOf(key).render({
                table,
                isSlow: frame => this.isSlow(key, frame)
            });
        }
    }
}

class StatView {
    constructor (name) {
        this.name = name;
        this.executions = 0;
        this.selfTime = 0;
        this.totalTime = 0;
    }

    update (selfTime, totalTime) {
        this.executions++;
        this.selfTime += selfTime;
        this.totalTime += totalTime;
    }

    render ({table, isSlow}) {
        const row = document.createElement('tr');
        let cell = document.createElement('td');
        cell.innerText = this.name;
        row.appendChild(cell);

        if (isSlow(this)) {
            row.setAttribute('class', 'slow');
        }

        cell = document.createElement('td');
        // Truncate selfTime. Value past the microsecond are floating point
        // noise.
        this.selfTime = Math.floor(this.selfTime * 1000) / 1000;
        cell.innerText = (this.selfTime / 1000).toPrecision(3);
        row.appendChild(cell);

        cell = document.createElement('td');
        // Truncate totalTime. Value past the microsecond are floating point
        // noise.
        this.totalTime = Math.floor(this.totalTime * 1000) / 1000;
        cell.innerText = (this.totalTime / 1000).toPrecision(3);
        row.appendChild(cell);

        cell = document.createElement('td');
        cell.innerText = this.executions;
        row.appendChild(cell);

        table.appendChild(row);
    }
}

class IdStatView {
    constructor (name) {    //should be name of refactoring
        this.name = name;
        this.failures = [];
    }

    update(blockIdRecords) {
        this.failures = blockIdRecords;
    }

    render ({table, isSlow}) {
        const row = document.createElement('tr');
        let cell = document.createElement('td');
        cell.innerText = this.name;
        row.appendChild(cell);

        //failures

        cell = document.createElement('td');
        cell.innerText = JSON.stringify(this.failures);
        row.appendChild(cell);

        if (isSlow(this)) {
            row.setAttribute('class', 'slow');
        }

        table.appendChild(row);
    }
}

class RunningStats {
    constructor (profiler) {
        this.stepThreadsInnerId = profiler.idByName('Sequencer.stepThreads#inner');
        this.blockFunctionId = profiler.idByName('blockFunction');
        this.stpeThreadsId = profiler.idByName('Sequencer.stepThreads');

        this.recordedTime = 0;
        this.executed = {
            steps: 0,
            blocks: 0
        };
    }

    update (id, selfTime, totalTime) {
        if (id === this.stpeThreadsId) {
            this.recordedTime += totalTime;
        } else if (id === this.stepThreadsInnerId) {
            this.executed.steps++;
        } else if (id === this.blockFunctionId) {
            this.executed.blocks++;
        }
    }
}

const WORK_TIME = 0.75;

class RunningStatsView {
    constructor ({runningStats, maxRecordedTime, dom}) {
        this.recordedTimeDom =
            dom.getElementsByClassName('profile-count-amount-recorded')[0];
        this.stepsLoopedDom =
            dom.getElementsByClassName('profile-count-steps-looped')[0];
        this.blocksExecutedDom =
            dom.getElementsByClassName('profile-count-blocks-executed')[0];

        this.maxRecordedTime = maxRecordedTime;
        this.maxWorkedTime = maxRecordedTime * WORK_TIME;
        this.runningStats = runningStats;
    }

    render () {
        const {
            runningStats,
            recordedTimeDom,
            stepsLoopedDom,
            blocksExecutedDom
        } = this;
        const {executed} = runningStats;
        const fractionWorked = runningStats.recordedTime / this.maxWorkedTime;
        recordedTimeDom.innerText = `${(fractionWorked * 100).toFixed(1)} %`;
        stepsLoopedDom.innerText = executed.steps;
        blocksExecutedDom.innerText = executed.blocks;
    }
}

class Frames {
    constructor (profiler) {
        this.profiler = profiler;

        this.frames = [];
    }

    update (id, selfTime, totalTime) {
        if (!this.frames[id]) {
            this.frames[id] = new StatView(this.profiler.nameById(id));
        }
        this.frames[id].update(selfTime, totalTime);
    }
}

const frameOrder = [
    'blockFunction',
    'execute',
    'Sequencer.stepThread',
    'Sequencer.stepThreads#inner',
    'Sequencer.stepThreads',
    'RenderWebGL.draw',
    'Runtime._step'
];

const trackSlowFrames = [
    'Sequencer.stepThreads',
    'Sequencer.stepThreads#inner',
    'Sequencer.stepThread',
    'execute'
];

class FramesTable extends StatTable {
    constructor (options) {
        super(options);

        this.profiler = options.profiler;
        this.frames = options.frames;
    }

    keys () {
        const keys = Object.keys(this.frames.frames)
            .map(id => this.profiler.nameById(Number(id)));
        keys.sort((a, b) => frameOrder.indexOf(a) - frameOrder.indexOf(b));
        return keys;
    }

    viewOf (key) {
        return this.frames.frames[this.profiler.idByName(key)];
    }

    isSlow (key, frame) {
        return (trackSlowFrames.indexOf(key) > 0 &&
        frame.selfTime / frame.totalTime > SLOW);
    }
}

class Opcodes {
    constructor (profiler) {
        this.blockFunctionId = profiler.idByName('blockFunction');

        this.opcodes = {};
    }

    update (id, selfTime, totalTime, arg) {
        if (id === this.blockFunctionId) {
            if (!this.opcodes[arg]) {
                this.opcodes[arg] = new StatView(arg);
            }
            this.opcodes[arg].update(selfTime, totalTime);
        }
    }
}

class Refactorings {
    constructor (profiler) {
        this.blockIdRecords = profiler.blockIdRecords;
        this.refactorings = {};
    }

    update () {
        let arg = "Extract Variable";
        // if (id === this.blockFunctionId) {
            if (!this.refactorings[arg]) {
                this.refactorings[arg] = new IdStatView(arg);
            }
            const failures = Object.keys(this.blockIdRecords).filter(k => k.startsWith("_assertion_failed"));
            this.refactorings[arg].update(failures);
        // }
    }
}

class OpcodeTable extends StatTable {
    constructor (options) {
        super(options);

        this.profiler = options.profiler;
        this.opcodes = options.opcodes;
        this.frames = options.frames;
    }

    keys () {
        const keys = Object.keys(this.opcodes.opcodes);
        keys.sort();
        return keys;
    }

    viewOf (key) {
        return this.opcodes.opcodes[key];
    }

    isSlow (key) {
        const blockFunctionTotalTime = this.frames.frames[this.profiler.idByName('blockFunction')].totalTime;
        const rowTotalTime = this.opcodes.opcodes[key].totalTime;
        const percentOfRun = rowTotalTime / blockFunctionTotalTime;
        return percentOfRun > SLOW;
    }
}

class RefactoringTable extends StatTable {
    constructor (options) {
        super(options);

        this.profiler = options.profiler;
        this.refactorings = options.refactorings;
        this.frames = options.frames;
    }

    keys () {
        const keys = Object.keys(this.refactorings.refactorings);
        keys.sort();
        return keys;
    }

    viewOf (key) {
        return this.refactorings.refactorings[key];
    }

    isSlow (key) {
        const blockFunctionTotalTime = this.frames.frames[this.profiler.idByName('blockFunction')].totalTime;
        const rowTotalTime = this.refactorings.refactorings[key].totalTime;
        const percentOfRun = rowTotalTime / blockFunctionTotalTime;
        return percentOfRun > SLOW;
    }
}

class ProfilerRun {
    constructor ({vm, maxRecordedTime, warmUpTime}) {
        this.vm = vm;
        this.maxRecordedTime = maxRecordedTime;
        this.warmUpTime = warmUpTime;

        vm.runtime.enableProfiling();
        const profiler = this.profiler = vm.runtime.profiler;
        vm.runtime.profiler = null;

        const runningStats = this.runningStats = new RunningStats(profiler);
        const runningStatsView = this.runningStatsView = new RunningStatsView({
            dom: document.getElementsByClassName('profile-count-group')[0],

            runningStats,
            maxRecordedTime
        });

        const frames = this.frames = new Frames(profiler);
        this.frameTable = new FramesTable({
            table: document
                .getElementsByClassName('profile-count-frame-table')[0]
                .getElementsByTagName('tbody')[0],

            profiler,
            frames
        });

        const opcodes = this.opcodes = new Opcodes(profiler);
        this.opcodeTable = new OpcodeTable({
            table: document
                .getElementsByClassName('profile-count-opcode-table')[0]
                .getElementsByTagName('tbody')[0],

            profiler,
            opcodes,
            frames
        });

        const refactorings = this.refactorings = new Refactorings(profiler);
        this.blockIdTable = new RefactoringTable({
            table: document
                .getElementsByClassName('profile-count-refactoring-table')[0]
                .getElementsByTagName('tbody')[0],

            profiler,
            refactorings,
            frames
        });

        const stepId = profiler.idByName('Runtime._step');
        profiler.onFrame = ({id, selfTime, totalTime, arg}) => {
            if (id === stepId) {
                runningStatsView.render();
            }
            runningStats.update(id, selfTime, totalTime, arg);
            opcodes.update(id, selfTime, totalTime, arg);
            refactorings.update();
            frames.update(id, selfTime, totalTime, arg);
        };
    }

    run () {
        this.projectId = loadProject();

        window.parent.postMessage({
            type: 'BENCH_MESSAGE_LOADING'
        }, '*');

        

        this.vm.on('workspaceUpdate', () => {

            setTimeout(() => {
                const url = "http://localhost:8080/refactor";
                var blockXmlPromise = new Promise(function(resolve, reject) {
                    resolve(getProgramXml());
                });
                blockXmlPromise.then(function(xml) {
                    fetch(url, {
                        method: "POST", // *GET, POST, PUT, DELETE, etc.
                        mode: "cors", // no-cors, cors, *same-origin
                        cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
                        headers: {
                            "Content-Type": "text/xml"
                        },
                        body: xml, // body data type must match "Content-Type" header
                    })
                    .then(response => response.json())
                    .then(function(json){
                        console.log(JSON.stringify(json));
                    });    
                });
            }, 100);            

            setTimeout(() => {
                window.parent.postMessage({
                    type: 'BENCH_MESSAGE_WARMING_UP'
                }, '*');
                this.vm.greenFlag();
            }, 100);
            setTimeout(() => {
                window.parent.postMessage({
                    type: 'BENCH_MESSAGE_ACTIVE'
                }, '*');
                this.vm.runtime.profiler = this.profiler;
            }, 100 + this.warmUpTime);
            setTimeout(() => {
                this.vm.stopAll();
                clearTimeout(this.vm.runtime._steppingInterval);

                let failures = null;
                console.log(this.vm.runtime.profiler.blockIdRecords);
                failures = Object.keys(this.vm.runtime.profiler.blockIdRecords).filter(k => k.startsWith("_assertion_failed"));
                console.log(failures);

                this.vm.runtime.profiler = null;

                this.frameTable.render();
                this.opcodeTable.render();
                this.blockIdTable.render();

                window.parent.postMessage({
                    type: 'BENCH_MESSAGE_COMPLETE',
                    frames: this.frames.frames,
                    opcodes: this.opcodes.opcodes,
                    refactorings: this.refactorings.refactorings
                }, '*');

                setShareLink({
                    fixture: {
                        projectId: this.projectId,
                        warmUpTime: this.warmUpTime,
                        recordingTime: this.maxRecordedTime
                    },
                    frames: this.frames.frames,
                    opcodes: this.opcodes.opcodes,
                    refactorings: this.refactorings.refactorings
                });
            }, 100 + this.warmUpTime + this.maxRecordedTime);
        });
    }

    render (json) {
        const {fixture} = json;
        document.querySelector('[type=text]').value = [
            fixture.projectId,
            fixture.warmUpTime,
            fixture.recordingTime
        ].join(',');

        this.frames.frames = json.frames.map(
            frame => Object.assign(new StatView(), frame, {
                name: this.profiler.nameById(this.profiler.idByName(frame.name))
            })
        );

        this.opcodes.opcodes = {};
        this.refactorings.refactorings = {};
        Object.entries(json.opcodes).forEach(([opcode, data]) => {
            this.opcodes.opcodes[opcode] = Object.assign(new StatView(), data);
        });

        Object.entries(json.refactorings).forEach(([opcode, data]) => {
            this.refactorings.refactorings[opcode] = Object.assign(new IdStatView(), data);
        });

        this.frameTable.render();
        this.opcodeTable.render();
        this.blockIdTable.render();
    }
}

/**
 * Run the benchmark with given parameters in the location's hash field or
 * using defaults.
 */
const runBenchmark = function () {
    // Lots of global variables to make debugging easier
    // Instantiate the VM.
    const vm = new window.VirtualMachine();
    Scratch.vm = vm;

    // Receipt of new block XML for the selected target.
    vm.on('workspaceUpdate', data => {
        workspace.clear();
        const dom = window.Blockly.Xml.textToDom(data.xml);
        window.Blockly.Xml.domToWorkspace(dom, workspace);
    });

    // Receipt of new list of targets, selected target update.
    const selectedTarget = document.getElementById('selectedTarget');
    vm.on('targetsUpdate', data => {
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
    selectedTarget.onchange = function () {
        vm.setEditingTarget(this.value);
    };

    // instantiate scratch-blocks
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
    

    vm.setTurboMode(false);  //turbo

    const storage = new ScratchStorage(); /* global ScratchStorage */
    const AssetType = storage.AssetType;

    storage.addWebSource([AssetType.Project], getLocalProjectUrl);
    storage.addWebSource([AssetType.ImageVector, AssetType.ImageBitmap, AssetType.Sound], getLocalAssetUrl);
    vm.attachStorage(storage);

    new LoadingProgress(progress => {
        document.getElementsByClassName('loading-total')[0]
            .innerText = progress.total;
        document.getElementsByClassName('loading-complete')[0]
            .innerText = progress.complete;
    }).on(storage);

    let warmUpTime = 1000;
    let maxRecordedTime = 2000;

    if (location.hash) {
        const split = location.hash.substring(1).split(',');
        if (split[1] && split[1].length > 0) {
            warmUpTime = Number(split[1]);
        }
        maxRecordedTime = Number(split[2] || '0') || 6000;
    }

    maxRecordedTime = 1000;

    new ProfilerRun({
        vm,
        warmUpTime,
        maxRecordedTime
    }).run();

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
        if (e.target !== document && e.target !== document.body) {
            return;
        }
        Scratch.vm.postIOData('keyboard', {
            keyCode: e.keyCode,
            isDown: true
        });
        e.preventDefault();
    });
    document.addEventListener('keyup', e => {
        // Always capture up events,
        // even those that have switched to other targets.
        Scratch.vm.postIOData('keyboard', {
            keyCode: e.keyCode,
            isDown: false
        });
        // E.g., prevent scroll.
        if (e.target !== document && e.target !== document.body) {
            e.preventDefault();
        }
    });

    // Run threads
    vm.start();
};

/**
 * Render previously run benchmark data.
 * @param {object} json data from a previous benchmark run.
 */
const renderBenchmarkData = function (json) {
    const vm = new window.VirtualMachine();
    new ProfilerRun({vm}).render(json);
    setShareLink(json);
};

window.onload = function () {
    if (location.hash.substring(1).startsWith('view')) {
        document.body.className = 'render';
        const data = location.hash.substring(6);
        const frozen = atob(data);
        const json = JSON.parse(frozen);
        renderBenchmarkData(json);
    } else {
        runBenchmark();
    }
};

window.onhashchange = function () {
    location.reload();
};