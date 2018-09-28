const Scratch = window.Scratch = window.Scratch || {};
const LOCAL_ASSET_SERVER = 'http://localhost:8000/';
const LOCAL_PROJECT_SERVER = 'http://localhost:8000/';

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
        const xmlString = `<${currTarget.isStage ? "stage " : "sprite "} name="${currTarget.getName()}"><xml><variables>${variables.map(v => v.toXML()).join()}</variables>${currTarget.blocks.toXML()}</xml></${currTarget.isStage ? "stage" : "sprite"}>`;

        //assembling
        targets += xmlString;
    }
    var str = `<program>${targets}</program>`;
    str = str.replace(/\s+/g, ' '); // Keep only one space character
    str = str.replace(/>\s*/g, '>');  // Remove space after >
    str = str.replace(/\s*</g, '<');  // Remove space before <

    return str;
}

const getLocalProjectUrl = function (asset) {
    const assetIdParts = asset.assetId.split('.');
    const assetUrlParts = [LOCAL_PROJECT_SERVER, assetIdParts[0] + '.sb3_FILES/', 'project.json'];
    if (assetIdParts[1]) {
        assetUrlParts.push(assetIdParts[1]);
    }
    return assetUrlParts.join('');
};

const getLocalAssetUrl = function (asset) {
    const assetUrlParts = [
        LOCAL_ASSET_SERVER,
        location.hash.substring(1).split(",")[0] + '.sb3_FILES/',
        asset.assetId,
        '.',
        asset.dataFormat
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

class StatTable {
    constructor({ table, keys, viewOf, isSlow, container }) {
        this.table = table;
        this.container = container;
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

    render() {
        const table = this.table;
        Array.from(table.children)
            .forEach(node => table.removeChild(node));
        const keys = this.keys();
        for (const key of keys) {
            this.viewOf(key).renderSimpleJson(this.container);
            this.viewOf(key).render({
                table,
                isSlow: frame => this.isSlow(key, frame)
            });
        }
    }
}



class IdStatView {
    constructor(name) {    //should be name of refactoring
        this.name = name;
        this.report = { 'projectId': 123456, 'type': 'extract_var', 'size_after': 5, 'exp_size': 4, 'duplications': 2};
        this.failures = [];
    }

    update(blockIdRecords) {
        this.failures = blockIdRecords;
        if (this.failures.length > 0) {
            this.report.success = false;
            this.report.failed_location = this.failures;
        }
    }

    renderSimpleJson(div) {
        let txt = "<table border='0'>"
        // header
        txt += "<thead>";
        txt += "<tr class='profile-count-refactoring-head'>";
        for (var key in this.report) {
            txt += "<th>" + key + "</th>";
        }
        txt += "</tr>";
        txt += "<thead>";
        // body
        txt += "<tr>";
        for (var key in this.report) {
            txt += "<td>" + this.report[key] + "</td>";
        }
        txt += "</tr>";

        txt += "</table>";
        div.innerHTML = txt;
        // this.name + this.failures;

    }

    render({ table, isSlow }) {
        const row = document.createElement('tr');
        let cell = document.createElement('td');
        cell.innerText = this.name;
        row.appendChild(cell);

        //failures

        cell = document.createElement('td');
        cell.innerText = JSON.stringify(this.failures);
        row.appendChild(cell);

        table.appendChild(row);
    }
}

class RunningStats {
    constructor(profiler) {
        this.stepThreadsInnerId = profiler.idByName('Sequencer.stepThreads#inner');
        this.blockFunctionId = profiler.idByName('blockFunction');
        this.stpeThreadsId = profiler.idByName('Sequencer.stepThreads');

        this.recordedTime = 0;
        this.executed = {
            steps: 0,
            blocks: 0
        };
    }

    update(id, selfTime, totalTime) {
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
    constructor({ runningStats, maxRecordedTime, dom }) {
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

    render() {
        const {
            runningStats,
            recordedTimeDom,
            stepsLoopedDom,
            blocksExecutedDom
        } = this;
        const { executed } = runningStats;
        const fractionWorked = runningStats.recordedTime / this.maxWorkedTime;
        recordedTimeDom.innerText = `${(fractionWorked * 100).toFixed(1)} %`;
        stepsLoopedDom.innerText = executed.steps;
        blocksExecutedDom.innerText = executed.blocks;
    }
}

class Refactorings {
    constructor(profiler) {
        this.blockIdRecords = profiler.blockIdRecords;
        this.refactorings = {};
    }

    update(blockIdRecords) {
        let arg = "Extract Variable";
        if (!this.refactorings[arg]) {
            this.refactorings[arg] = new IdStatView(arg);
        }

        const failures = Object.keys(blockIdRecords).filter(k => k.startsWith("_assertion_failed"));
        this.refactorings[arg].update(failures);

        // }
    }
}

class RefactoringTable extends StatTable {
    constructor(options) {
        super(options);

        this.profiler = options.profiler;
        this.refactorings = options.refactorings;
    }

    keys() {
        const keys = Object.keys(this.refactorings.refactorings);
        keys.sort();
        return keys;
    }

    viewOf(key) {
        return this.refactorings.refactorings[key];
    }
}

class ProfilerRun {
    constructor({ vm, maxRecordedTime, warmUpTime }) {
        this.vm = vm;
        this.maxRecordedTime = maxRecordedTime;
        this.warmUpTime = warmUpTime;

        this.report = {};

        this.firstTimeWorkspaceUpdate = true;

        vm.runtime.enableProfiling();
        const profiler = this.profiler = vm.runtime.profiler;
        vm.runtime.profiler = null;

        const runningStats = this.runningStats = new RunningStats(profiler);
        const runningStatsView = this.runningStatsView = new RunningStatsView({
            dom: document.getElementsByClassName('profile-count-group')[0],

            runningStats,
            maxRecordedTime
        });

        const refactorings = this.refactorings = new Refactorings(profiler);
        this.invalidBlockExecIdTable = new RefactoringTable({
            table: document
                .getElementsByClassName('profile-count-refactoring-table')[0]
                .getElementsByTagName('tbody')[0],
            container: document.getElementById('profile-refactoring-result'),
            profiler,
            refactorings
        });

        const stepId = profiler.idByName('Runtime._step');
        profiler.onFrame = ({ id, selfTime, totalTime, arg }) => {
            if (id === stepId) {
                runningStatsView.render();
            }
            runningStats.update(id, selfTime, totalTime, arg);
        };
    }

    run(id) {
        this.projectId = id;
        return this.runProfiler();
    }

    runProfiler() {
        console.log("run profiler...");
        this.vm.start();
        //TODO: apply refactoring, before greenFlag
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

        return new Promise((resolve, reject) => {
            setTimeout(() => {
                console.log("cleaning up");
                this.vm.stopAll();
                clearTimeout(this.vm.runtime._steppingInterval);

                let failures = Object.keys(this.profiler.blockIdRecords).filter(k => k.startsWith("_assertion_failed"));
                if (failures.length > 0) {
                    this.report.success = false;
                }

                this.vm.runtime.profiler = null;
                resolve(this.report);
            }, 100 + this.warmUpTime + this.maxRecordedTime);
        });
    }

    render(json) {
        const { fixture } = json;
        document.querySelector('[type=text]').value = [
            fixture.projectId,
            fixture.warmUpTime,
            fixture.recordingTime
        ].join(',');

        this.refactorings.refactorings = {};

        Object.entries(json.refactorings).forEach(([key, data]) => {
            this.refactorings.refactorings[key] = Object.assign(new IdStatView(), data);
        });
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
    
    //connect workspace to vm
    Scratch.workspace.addChangeListener(Scratch.vm.blockListener);
    Scratch.workspace.addChangeListener(Scratch.vm.variableListener);
    const flyoutWorkspace = Scratch.workspace.getFlyout().getWorkspace();
    flyoutWorkspace.addChangeListener(Scratch.vm.flyoutBlockListener);
    flyoutWorkspace.addChangeListener(Scratch.vm.monitorBlockListener);



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

    let warmUpTime = 2000;
    let maxRecordedTime = 3000;

    if (location.hash) {
        const split = location.hash.substring(1).split(',');
        if (split[1] && split[1].length > 0) {
            warmUpTime = Number(split[1]);
        }
        maxRecordedTime = Number(split[2] || '0') || 6000;
    }

    maxRecordedTime = 1000;

    //TODO 
    // SEND REQUEST
    // LOAD REFACTORABLE
    // APPLY 
    // PROFILE RUN
    const projectId = loadProject();

    const sendAnalysisRequest = function() {
        const url = "http://localhost:8080/refactor";
        const testReport = { 'projectId': 'id', 'type': 'extract_var', 'size_after': 5, 'exp_size': 4, 'duplications': 2 };
        return new Promise(function (resolve, reject) {

            resolve(getProgramXml());

        }).then(function (xml) {
            return fetch(url, {
                method: "POST", // *GET, POST, PUT, DELETE, etc.
                mode: "cors", // no-cors, cors, *same-origin
                cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
                headers: {
                    "Content-Type": "text/xml"
                },
                body: xml, // body data type must match "Content-Type" header
            });
        }).then(response => response.json());
    }

    
    
    vm.on('workspaceUpdate', () => {
        // if (this.firstTimeWorkspaceUpdate) {
        //     this.firstTimeWorkspaceUpdate = false;
        // } else {
        //     return;
        // }

        window.parent.postMessage({
            type: 'BENCH_MESSAGE_LOADING'
        }, '*');

        sendAnalysisRequest().then(json => {
            //TODO: record roundtrip for whole project analysis request
            const refactorables = document.getElementById('refactorables');
            return {json:json, selectRefactorableDom: renderRefactorables(refactorables,json, Scratch.workspace, {})};
        }).then(({json, selectRefactorableDom}) => {
            (async function refactorEvalLoop(){
                for (let i = 0; i < selectRefactorableDom.length; i++) {
                    let profilerRun = new ProfilerRun({vm,warmUpTime,maxRecordedTime});
                    selectRefactorableDom.selectedIndex = i;
                    selectRefactorableDom.dispatchEvent(new Event('change'));   
                    console.log("apply refactorable:"+i);
                    //START timer
                    const t0 = performance.now();
                    Scratch.workspace.blockTransformer.doTransform(json[selectRefactorableDom.value]);
                    //STOP timer
                    const t1 = performance.now();
                    // report.resp_time = t1 - t0;
                    await profilerRun.run(projectId);
                    console.log("prepare final report");
                    profilerRun.refactorings.update(profilerRun.profiler.blockIdRecords);
                    profilerRun.invalidBlockExecIdTable.render();
                    window.parent.postMessage({
                        type: 'BENCH_MESSAGE_COMPLETE',
                        refactorings: profilerRun.refactorings.refactorings
                    }, '*');
                }
            })();
        });
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

const renderRefactorables = function (refactorables, data, workspace, report) {
    var keys = Object.keys(data);
    
    for (let i = 0; i < keys.length; i++) {
        const refactorable = document.createElement('option');
        refactorable.setAttribute('value', data[keys[i]].id);

        refactorable.appendChild(
            document.createTextNode(data[keys[i]].id)
        );

        refactorables.appendChild(refactorable);
    }

    refactorables.onchange = function () {
        // do nothing
    };

    return refactorables;
}



/**
 * Render previously run benchmark data.
 * @param {object} json data from a previous benchmark run.
 */
const renderBenchmarkData = function (json) {
    const vm = new window.VirtualMachine();
    new ProfilerRun({ vm }).render(json);
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