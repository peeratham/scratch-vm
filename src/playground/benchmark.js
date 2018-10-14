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
    projectInput.value = id;
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
    const assetUrlParts = [LOCAL_PROJECT_SERVER, assetIdParts[0] + '/', 'project.json'];
    if (assetIdParts[1]) {
        assetUrlParts.push(assetIdParts[1]);
    }
    return assetUrlParts.join('');
};

const getLocalAssetUrl = function (asset) {
    const assetUrlParts = [
        LOCAL_ASSET_SERVER,
        location.hash.substring(1).split(",")[0] + '/',
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

class IdStatView {
    constructor(report) {    //should be name of refactoring
        this.report = report;
    }

    update(failures) {
        if (failures.length > 0) {
            this.report.success = false;
            this.report.failed_location = failures;
        }
    }

    updateReport(key, value) {
        this.report[key] = value;
    }

    renderSimpleJson(div) {
        let table = div.getElementsByTagName("table")[0];
        //if no table header yet
        if (table.rows.length === 0) {
            let txt = "<thead>";
            txt += "<tr class='profile-count-refactoring-head'>";
            for (var key in this.report) {
                txt += "<th>" + key + "</th>";
            }
            txt += "</tr>";
            txt += "<thead>";
            let header = table.insertRow(0);
            header.innerHTML = txt;
        }

        // body        
        let row = table.insertRow(table.rows.length);
        let rowtxt = "<tr>";
        for (var key in this.report) {
            rowtxt += "<td>" + this.report[key] + "</td>";
        }
        rowtxt += "</tr>";
        row.innerHTML = rowtxt;

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
    constructor(profiler, report) {
        this.blockIdRecords = profiler.blockIdRecords;
        this.executedBlockIds = null;
        this.stats = new IdStatView(report);
    }

    update(blockIdRecords) {
        const failures = Object.keys(blockIdRecords).filter(k => k.startsWith("_assertion_failed"));
        this.stats.update(failures);
    }
}

class RefactoringTable {
    constructor(options) {
        this.profiler = options.profiler;
        this.stats = options.stats;
        this.container = options.containerDom;
    }
    render() {
        this.view().renderSimpleJson(this.container);
    }

    keys() {
        const keys = Object.keys(this.stats.stats);
        keys.sort();
        return keys;
    }

    view() {
        return this.stats.stats;
    }
}

class ProfilerRun {
    constructor({ vm, maxRecordedTime, warmUpTime, projectId, initialReport, resultDiv, targetInvariantChecks }) {
        this.vm = vm;
        this.maxRecordedTime = maxRecordedTime;
        this.warmUpTime = warmUpTime;
        this.projectId = projectId;
        this.targetInvariantChecks = targetInvariantChecks;

        this.report = {};


        vm.runtime.enableProfiling();
        const profiler = this.profiler = vm.runtime.profiler;
        vm.runtime.profiler = null;

        const runningStats = this.runningStats = new RunningStats(profiler);
        const runningStatsView = this.runningStatsView = new RunningStatsView({
            dom: document.getElementsByClassName('profile-count-group')[0],
            runningStats,
            maxRecordedTime
        });

        const stats = this.stats = new Refactorings(profiler, initialReport);
        this.resultTable = new RefactoringTable({
            containerDom: resultDiv,
            profiler,
            stats
        });

        const stepId = profiler.idByName('Runtime._step');
        profiler.onFrame = ({ id, selfTime, totalTime, arg }) => {
            if (id === stepId) {
                runningStatsView.render();
            }
            runningStats.update(id, selfTime, totalTime, arg);
        };
    }

    run() {
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
                //TODO: Scratch.vm.runtime.getTargetForStage().lookupVariableById(vid).value

                this.vm.runtime.profiler = null;
                resolve();
            }, 100 + this.warmUpTime + this.maxRecordedTime);
        });
    }

    coverage() {
        let executedBlocks = new Set(Object.keys(this.profiler.blockIdRecords));
        let uncoveredChecks = new Set([...this.targetInvariantChecks].filter(x => !executedBlocks.has(x)));
        let coverage = (this.targetInvariantChecks.size - uncoveredChecks.size) / this.targetInvariantChecks.size;
        return coverage;
    }

    render(json) {
        const { fixture } = json;
        document.querySelector('[type=text]').value = [
            fixture.projectId,
            fixture.warmUpTime,
            fixture.recordingTime
        ].join(',');

        this.refactorings.refactorings = {};

        // Object.entries(json.refactorings).forEach(([key, data]) => {
        this.refactorings.refactorings = Object.assign(new IdStatView(), data);
        // });
    }
}
let warmUpTime = 2000;
let maxRecordedTime = 3000;
/**
 * Run the benchmark with given parameters in the location's hash field or
 * using defaults.
 */
const runBenchmark = function () {
    // Lots of global variables to make debugging easier
    // Instantiate the VM.
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

    const xmlButton = document.getElementById('getXml');
    xmlButton.addEventListener("click",function(){
        let xml = Scratch.vm.editingTarget.blocks.toXML();
        let str = xml.replace(/\s+/g, ' '); // Keep only one space character
        str = str.replace(/>\s*/g, '>');  // Remove space after >
        str = str.replace(/\s*</g, '<');  // Remove space before <
        console.log(str);
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



    if (location.hash) {
        const split = location.hash.substring(1).split(',');
        if (split[1] && split[1].length > 0) {
            warmUpTime = Number(split[1]);
        }
        maxRecordedTime = Number(split[2] || '0') || 6000;
    }

    maxRecordedTime = 1000;

    const resultDiv = document.getElementById('profile-refactoring-result');
    resultDiv.innerHTML = "<table border='0'></table>"

    const projectId = loadProject();




    let manualMode = true;

    vm.on('workspaceReady', data => {
        let evaluator = new RefactoringEvaluator(projectId, data, manualMode, resultDiv);
            evaluator.runAll();
        
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

class RefactoringEvaluator {
    constructor(projectId, data, manualMode, resultDiv) {
        this.projectId = projectId;
        this.data = data;
        this.manualMode = manualMode;
        this.resultDiv = resultDiv
        this.analysisInfo = null;
    }
    async getAnalysisInfo() {
        if(this.analysisInfo){
            return this.analysisInfo;
        }
        const url = "http://localhost:8080/discover";
        const xml = await new Promise(function (resolve, reject) {
            resolve(getProgramXml());
        });
        
        const response = await fetch(url, {
            method: "POST",
            mode: "cors",
            cache: "no-cache",
            headers: {
                "Content-Type": "text/xml",
                "id": this.projectId,
                "type": "duplicate-code"
            },
            body: xml,
        });

        this.analysisInfo = response.json();
        
        return this.analysisInfo;
    }

    renderRefactorables(refactorables, data) {
        var refactorableData = data['improvables'];
        let refactorableKV = {};

        for (let i = 0; i < refactorableData.length; i++) {
            refactorableKV[refactorableData[i].id] = refactorableData[i];
            const refactorable = document.createElement('option');
            refactorable.setAttribute('value', refactorableData[i].id);

            refactorable.appendChild(
                document.createTextNode(refactorableData[i].target+":"+refactorableData[i].id)
            );

            refactorables.appendChild(refactorable);
        }

        refactorables.onchange = ()=> {
            console.log(refactorables.value);
            console.log(refactorableKV[refactorables.value]);
            
            (async () => {
                //undo from previous refactoring transformation if applicable
                while (Scratch.workspace.hasUndoStack()) {
                    await Scratch.workspace.undo();
                    await Blockly.Events.fireNow_();
                }


                let refactorable = refactorableKV[refactorables.value];
                let refactoringTarget = refactorable["target"];
                // this.switchTarget(refactorables.selectedIndex, refactorables, refactoringTarget);
                if (Scratch.vm.editingTarget.getName() != refactoringTarget) {
                    console.log("switch target to:" + refactoringTarget);
                    let targetId = Scratch.vm.runtime.targets.filter(t => t.getName() === refactoringTarget)[0].id;
                    Scratch.vm.setEditingTarget(targetId);
                }
                
                let report = {};
                Blockly.Events.recordUndo = true;
                try{
                    await this.refactor(refactorable.transforms, report);
                }catch(err){
                    console.error(err.message);
                    console.log("Try to restore workspace...");
                    while (Scratch.workspace.hasUndoStack()) {
                        await Scratch.workspace.undo();
                        await Blockly.Events.fireNow_();
                    }
                    throw new Error("Error applying transformation");
                }
                // await this.runProfile(initialReport);

                //clean up (undo changes)

             

                console.log(report);
              
            })();
            
        };

        return refactorables;
    }


    switchTarget(i, selectRefactorableDom, refactoringTarget) {
        //programmatically select refactorable to execute
        selectRefactorableDom.selectedIndex = i;
        selectRefactorableDom.dispatchEvent(new Event('change'));
        //select target

        if (Scratch.vm.editingTarget.getName() != refactoringTarget) {
            console.log("switch target to:" + refactoringTarget);
            let targetId = Scratch.vm.runtime.targets.filter(t => t.getName() === refactoringTarget)[0].id;
            Scratch.vm.setEditingTarget(targetId);
        }
    }

    async refactor(transforms,initialReport){
        console.log(transforms);
        //START timer
        const t0 = performance.now();

        try {
            for (var action of transforms) {
                await Scratch.workspace.blockTransformer.executeAction(action);
                //synchronous for now to make sure vm update its internal representation correclty in sequence of the applied transformation
                await Blockly.Events.fireNow_();
            }
        } catch (err) {
            throw err;
        }

        //STOP timer
        const t1 = performance.now();
        
        initialReport.resp_time = t1 - t0;

    }

    async runProfile(initialReport){
        let targetInvariantChecks = new Set(["T?,F,g{dyE*rx3/EdX^H", "_assertion_failed", "invariant02"]);
        let profilerRun = new ProfilerRun({ vm: Scratch.vm, warmUpTime, maxRecordedTime, projectId: this.projectId, initialReport, resultDiv: this.resultDiv, targetInvariantChecks });
        await profilerRun.run();

        // repeat profile run for coverage
        let count = 0;
        const maxCoverageRunAttempts = 3;
        // while(profilerRun.coverage()<0.8 && count < maxCoverageRunAttempts){
        // console.log("coverage:" + profilerRun.coverage());
        // await profilerRun.run();
        // count++;
        // }

        //prepare final report for this refactoring
        profilerRun.stats.update(profilerRun.profiler.blockIdRecords);
        profilerRun.resultTable.render();
    }

    runAll() {
        window.parent.postMessage({
            type: 'BENCH_MESSAGE_LOADING'
        }, '*');

        const projectReport = { "project_id": this.projectId, "improvables": [] };

        this.getAnalysisInfo().then(json => {
            const refactorables = document.getElementById('improvables');
            let selectRefactorableDom = this.renderRefactorables(refactorables, json,projectReport)
            return { json, selectRefactorableDom };
        })
        .then(({ json, selectRefactorableDom }) => {
            Blockly.Events.recordUndo = true;
            if (this.manualMode) {
                return;
            }
            (async () => {
                for (let i = 0; i < selectRefactorableDom.length; i++) {
                    while (Scratch.workspace.hasUndoStack()) {
                        await Scratch.workspace.undo();
                        await Blockly.Events.fireNow_();
                    }

                    let refactoringTarget = json['improvables'][i]["target"];
                    this.switchTarget(i, selectRefactorableDom, refactoringTarget);

                    projectReport['project_metrics'] = json['project_metrics'];
                    let initialReport = json['improvables'][i].info;

                    let refactorable_id = initialReport.refactorable_id = selectRefactorableDom.value;
                    await this.refactor(json['improvables'][i].transforms, initialReport);
                    await this.runProfile(initialReport);

                    projectReport["improvables"].push(initialReport);

                    //clean up (undo changes)

                    

                }
                // finalize and send project report to benchmark suite
                console.log(projectReport);
                window.parent.postMessage({
                    type: 'BENCH_MESSAGE_COMPLETE',
                    projectReport: projectReport
                }, '*');
            })();

        }).then(() => {

        });
    }

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