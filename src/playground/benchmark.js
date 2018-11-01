const projectInput = document.querySelector('input');

const manualMode = true;
let warmUpTime = 2000;
let maxRecordedTime = 10000;
const WORK_TIME = 0.75;

document.querySelector('.run').addEventListener('click', () => {
        window.location.hash = projectInput.value;
        location.reload();
    }, false);


const profileButton = document.getElementById("profile");
profileButton.addEventListener("click", async function(){
    // initialize report with server analysis info
    if(Scratch.json){
        var projectReport = Scratch.projectReport =  { "project_id": Project.ID, "improvables": [] };
        projectReport['project_metrics'] = Scratch.json['project_metrics'];

        var refactorable_id = document.getElementById('improvables').value;

        // prepare initial client report
        var initialReport = {refactorable_id};
        if(Scratch.refactorableKV[refactorable_id]){
            initialReport = Scratch.refactorableKV[refactorable_id].info;
        }

         // prepare profileRun parameters
        var resultDiv = document.getElementById('profile-refactoring-result');
        var targetInvariantChecks = []; // TODO get from coverageInfo
    }
    
    let profilerRun = Scratch.ProfileRun = new ProfilerRun({ vm: Scratch.vm, warmUpTime, maxRecordedTime:maxRecordedTime, projectId: Project.ID, initialReport:initialReport, resultDiv: resultDiv, targetInvariantChecks });
    await profilerRun.runProfiler();
    
    // if improvable is selected only
    if(Scratch.json){
        profilerRun.resultTable.render();
        //update suite evaluation info   
        projectReport["improvables"].push(initialReport);
        window.parent.postMessage({
            type: 'BENCH_MESSAGE_COMPLETE',
            projectReport: projectReport
        }, '*');    
    }
});

const analyzeButton = document.getElementById("analyze");
analyzeButton.addEventListener("click", async function(){
    const idInput = document.getElementById("projectIdInput");
    let result = await sendAnalysisRequestFun(idInput.value);
    // update
    const refactorables = document.getElementById('improvables');
    renderRefactorableList(refactorables, result);

});


/**
* Refactorings keep track of stats specific to refactoring both already analyzed from the server and some that are augmented
e.g. safety evaluation info.
*/
class Refactorings {
    constructor(profiler, report) {
        this.blockIdRecords = profiler.blockIdRecords;
        this.executedBlockIds = null;
        this.stats = new IdStatView(report);
        this.numBlocksCovered = 0;
        this.totalReachableStmt = 21;
        this.completed = 0;
    }

    //update block ids that have been executed so far
    // try to keep track of unique blocks counted
    update() {
        let ids = Object.keys(this.blockIdRecords);
        if(ids.length!=this.numBlocksCovered){
            console.log(this.blockIdRecords);
            this.numBlocksCovered = ids.length;
            this.completed = this.numBlocksCovered/this.totalReachableStmt;
            console.log((this.completed*100)+"%");
        }
    }

    shouldStop(){
        const failures = Object.keys(this.blockIdRecords).filter(k => k.startsWith("#invariant_failure_counter"));
        if(failures.length>0){
            this.stats.update(failures);
            return true;
        }
        
        // completion relative to orginal blocks not including invariant checks
        if(this.completed >= 1.3){
            return true;
        }

        return false;
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
        //todo remove because we just going to use some prefix to check
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

       
    }

    stopProfileRun(){
        this.vm.runtime.disableProfiling();
        this.vm.stopAll();
        clearTimeout(this.vm.runtime._steppingInterval);
    }

    runProfiler() {
        this.vm.start();
        
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
        
        const profiler = this.profiler;
        const stepId = profiler.idByName('Runtime._step');
        profiler.onFrame = ({ id, selfTime, totalTime, arg }) => {
            if (id === stepId) {
                this.runningStatsView.render();
            }
            this.runningStats.update(id, selfTime, totalTime, arg);
            this.stats.update();
        };
        
        return new Promise((resolve, reject) => {
            var stopOnTimeLimit = setTimeout(() => {
                this.stopProfileRun();
                clearInterval(checkCompletion);
//                 let failures = Object.keys(this.profiler.blockIdRecords).filter(k => k.startsWith("_assertion_failed"));
//                 if (failures.length > 0) {
//                     this.report.success = false;
//                 }
//                 //TODO: Scratch.vm.runtime.getTargetForStage().lookupVariableById(vid).value
//                 this.vm.runtime.profiler = null;
                resolve();
            }, 100 + this.warmUpTime + this.maxRecordedTime);

            var checkCompletion = setInterval(()=>{
                 if(this.stats.shouldStop()){
                    this.stopProfileRun();
                    clearTimeout(stopOnTimeLimit);
                    clearInterval(checkCompletion);
                    resolve();
                }
            }, 10);
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

        // Object.entries(json.refactorings).forEach(([key, data]) => {
        this.refactorings.refactorings = Object.assign(new IdStatView(), data);
        // });
    }
}


const sendAnalysisRequestFun = async function(projectId){
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
            "id": projectId,
            "type": "duplicate-expression",
            'evalMode': true
        },
        body: xml,
    });

    let analysisInfo = response.json();

    return analysisInfo;
};

const populateWalkThru = function(improvable){
        // populate changes walk through
        let changesWalkThrough = document.getElementById('changesWalkThrough');
        while (changesWalkThrough.firstChild) { //clear
            changesWalkThrough.removeChild(changesWalkThrough.firstChild);
        }
        
        if(improvable.transforms.length!=0){
            let createdBlockActions = improvable.transforms.filter((itm)=>itm.type==='BlockCreateAction')
            for(var action of createdBlockActions){
                const changeItem = document.createElement('option');
                changeItem.setAttribute('value', action.blockId);
                changeItem.appendChild(
                    document.createTextNode(action.info + ": "+ action.blockId)
                );
                changesWalkThrough.appendChild(changeItem);
            }
        }else{
            // in debug/eval mode walkthru smells
            for(var blockId of improvable.smells){
                const changeItem = document.createElement('option');
                changeItem.setAttribute('value', blockId);
                changeItem.appendChild(
                    document.createTextNode(blockId)
                );
                changesWalkThrough.appendChild(changeItem);
            }
        }
        

        changesWalkThrough.onchange = function() {
            let id = this.value;
            Blockly.getMainWorkspace().centerOnBlock(id);
            setTimeout(()=>{
                Blockly.getMainWorkspace().reportValue(id,id);
            },500)
        }

};

const switchTarget =  async function(refactoringTarget) {
    if (Scratch.vm.editingTarget.getName() != refactoringTarget) {
        console.log("switch target to:" + refactoringTarget);
        let targetId = Scratch.vm.runtime.targets.filter(t => t.getName() === refactoringTarget)[0].id;
        Blockly.Events.recordUndo = false;
        await Scratch.vm.setEditingTarget(targetId);
        Blockly.Events.recordUndo = true;
    }
}


const renderRefactorableList = function(refactorables, json){
    if (json.error != null) {
        console.log(JSON.stringify(json.error));
        return;
    }else{
        Scratch.json = json; 
    }
    
    var refactorableData = json['improvables'];
    let refactorableKV = Scratch.refactorableKV = {};

    //TODO sort which to show first (refactorable transform >0 then smell)
    let sortedRefactorables = refactorableData.sort((ref1,ref2)=>ref2.transforms.length-ref1.transforms.length);
    refactorableData = sortedRefactorables;

    for (let i = 0; i < refactorableData.length; i++) {
        refactorableKV[refactorableData[i].id] = refactorableData[i];
        const refactorable = document.createElement('option');
        refactorable.setAttribute('value', refactorableData[i].id);

        refactorable.appendChild(
            document.createTextNode(refactorableData[i].target + ":" + refactorableData[i].id)
        );

        refactorables.appendChild(refactorable);
    }

    refactorables.onchange = async () => {
        let improvable = refactorableKV[refactorables.value]
        
        //cleaning up previous transformations
        while (Scratch.workspace.hasUndoStack()) {
            await Scratch.workspace.undo();
            await Blockly.Events.fireNow_();
        }

        
        //TODO: switch target if needed
        let refactoringTarget = improvable["target"];
        await switchTarget(refactoringTarget);

        await applyTransformations(improvable.transforms,{});
        await setupInvariantChecks(json['checkSetup'], improvable.invariants);


        populateWalkThru(improvable);
        

        //populate field to report safety evaluation data
        const failButton = document.getElementById("markAsFailButton");
        const comment = document.getElementById("comment");
        
        failButton.addEventListener("click", function(){
            
            let refactorable_id = document.getElementById('improvables').value;
            let initialReport = {refactorable_id:refactorable_id};
            // let improvable = projectReport.improvables.find((itm)=>itm.refactorable_id===refactorable_id)||{};
            initialReport.predicted = improvable.transforms.length? "pass":"fail";
            initialReport.actual = "fail";//override
            
            initialReport.comment = comment.value;
            
            Scratch.projectReport["improvables"].push(initialReport);
            return;
        });
    };
};

 const applyTransformations = async function(transforms, initialReport) {
        Blockly.Events.recordUndo = true;
        console.log(transforms);
        //START timer
        const t0 = performance.now();


        for (var action of transforms) {
            try {
                await Scratch.workspace.blockTransformer.executeAction(action);
                //synchronous for now to make sure vm update its internal representation correclty in sequence of the applied transformation
                await Blockly.Events.fireNow_();
            } catch (err) {
                console.log("Failed transformation:" + JSON.stringify(action));
                throw err;
            }
        }


        //STOP timer
        const t1 = performance.now();

        initialReport.resp_time = t1 - t0;
        initialReport.num_transforms = transforms.length;

    }

const setupInvariantChecks = function(setupObj,invChecks){
    let actions = setupObj['actions'];
    (async () => {
            await applyTransformations(actions, {});
            await applyTransformations(invChecks, {});
    })();
}


class RefactoringEvaluator {
    constructor(projectId, data, manualMode, resultDiv) {
        this.projectId = projectId;
        this.data = data;
        this.manualMode = manualMode;
        this.resultDiv = resultDiv
        this.analysisInfo = null;
    }
    async getAnalysisInfo(sendRequestFunc) {
        let cache = {"improvables":[{"id":"8puAy","type":"extract_var","target":"Sprite1","transforms":[{"type":"VarDeclareAction","name":"renamable_var4W","id":"var_DtYbSI"},{"type":"BlockCreateAction","blockId":"block_ttP9UL","info":"data_setvariableto","block_xml":"<xml><block type='data_setvariableto' id='block_ttP9UL'><field name='VARIABLE' id='var_DtYbSI' variabletype=''>renamable_var4W</field><value name='VALUE'><shadow type='text'><field name='TEXT'>0</field></shadow><block type='operator_round' id='mF'><value name='NUM'><shadow type='math_number' id='Bw'><field name='NUM'></field></shadow><block type='operator_divide' id='ab'><value name='NUM1'><shadow type='math_number' id='8D'><field name='NUM'></field></shadow><block type='data_variable' id='yQ'><field name='VARIABLE' id='`jEk@4|i[#Fk?(8x)AV.-my variable' variabletype=''>my variable</field></block></value><value name='NUM2'><shadow type='math_number' id='Jw'><field name='NUM'>10</field></shadow></value></block></value></block></value></block></xml>"},{"type":"InsertBlockAction","inserted_block":"block_ttP9UL","target_block":"OMb15qBkM449oqpt#B1y"},{"type":"BlockCreateAction","blockId":"block_mKmosv","info":"data_variable","block_xml":"<xml><block type='data_variable' id='block_mKmosv'><field name='VARIABLE' id='var_DtYbSI' variabletype=''>renamable_var4W</field></block></xml>"},{"type":"ReplaceAction","target_block":"$5Y`0g5kAFF{87.8]UEJ","replace_with":"block_mKmosv"},{"type":"BlockCreateAction","blockId":"block_rUbySP","info":"data_variable","block_xml":"<xml><block type='data_variable' id='block_rUbySP'><field name='VARIABLE' id='var_DtYbSI' variabletype=''>renamable_var4W</field></block></xml>"},{"type":"ReplaceAction","target_block":"{29LNjX})_,mt%-7gKWD","replace_with":"block_rUbySP"}],"invariants":[{"type":"BlockCreateAction","blockId":"@_invariant_check_rjtSGe","info":"procedures_call","block_xml":"<xml><block type='procedures_call' id='@_invariant_check_rjtSGe'><mutation proccode='assertEquals %s %s' argumentids='[&quot;varId&quot;,&quot;exprRootId&quot;]' warp='null'/><value name='varId'><shadow type='text'><field name='TEXT'></field></shadow><block type='data_variable'><field name='VARIABLE' id='var_DtYbSI' variabletype=''>renamable_var4W</field></block></value><value name='exprRootId'><shadow type='text'><field name='TEXT'></field></shadow><block type='operator_round' id='Sl'><value name='NUM'><shadow type='math_number' id='cJ'><field name='NUM'></field></shadow><block type='operator_divide' id='JD'><value name='NUM1'><shadow type='math_number' id='KR'><field name='NUM'></field></shadow><block type='data_variable' id='Y8'><field name='VARIABLE' id='`jEk@4|i[#Fk?(8x)AV.-my variable' variabletype=''>my variable</field></block></value><value name='NUM2'><shadow type='math_number' id='5B'><field name='NUM'>10</field></shadow></value></block></value></block></value></block></xml>"},{"type":"InsertBlockAction","inserted_block":"@_invariant_check_rjtSGe","target_block":"[#04tE|XJ^HC4475%psJ"},{"type":"BlockCreateAction","blockId":"@_invariant_check_eeD2rC","info":"procedures_call","block_xml":"<xml><block type='procedures_call' id='@_invariant_check_eeD2rC'><mutation proccode='assertEquals %s %s' argumentids='[&quot;varId&quot;,&quot;exprRootId&quot;]' warp='null'/><value name='varId'><shadow type='text'><field name='TEXT'></field></shadow><block type='data_variable'><field name='VARIABLE' id='var_DtYbSI' variabletype=''>renamable_var4W</field></block></value><value name='exprRootId'><shadow type='text'><field name='TEXT'></field></shadow><block type='operator_round' id='2b'><value name='NUM'><shadow type='math_number' id='7y'><field name='NUM'></field></shadow><block type='operator_divide' id='3P'><value name='NUM1'><shadow type='math_number' id='oL'><field name='NUM'></field></shadow><block type='data_variable' id='uS'><field name='VARIABLE' id='`jEk@4|i[#Fk?(8x)AV.-my variable' variabletype=''>my variable</field></block></value><value name='NUM2'><shadow type='math_number' id='An'><field name='NUM'>10</field></shadow></value></block></value></block></value></block></xml>"},{"type":"InsertBlockAction","inserted_block":"@_invariant_check_eeD2rC","target_block":"26=1Bcw)bUu~}O@z;W7o"}],"info":{"num_blocks":29,"analysis_time":54,"expr_clone_group_size":2,"expr_clone_size":4,"num_blocks_changed":0},"smells":[]}],"checkSetup":{"actions":[{"type":"VarDeclareAction","name":"__inv_failure_count","id":"__inv_failure_count"},{"type":"BlockCreateAction","blockId":null,"info":null,"block_xml":"<xml><block type='procedures_definition' id='assertEqualID'><value name='custom_block'><shadow type='procedures_prototype' id='IuyWt'><mutation proccode='assertEquals %s %s' argumentids='[&quot;varId&quot;,&quot;exprRootId&quot;]' argumentnames='[&quot;var&quot;,&quot;expr&quot;]' argumentdefaults='[&quot;&quot;,&quot;&quot;]' warp='false'/><value name='varId'><shadow type='argument_reporter_string_number' id='JkwEZG'><field name='VALUE'>var</field></shadow></value><value name='exprRootId'><shadow type='argument_reporter_string_number' id='AEbTyw'><field name='VALUE'>expr</field></shadow></value></shadow></value><next><block type='control_if' id='KsHyb7'><value name='CONDITION'><block type='operator_not' id='TtIg4y'><value name='OPERAND'><shadow type='text'><field name='TEXT'></field></shadow><block type='operator_equals' id='U1IFUz'><value name='OPERAND1'><shadow type='text'><field name='TEXT'></field></shadow><block type='argument_reporter_string_number' id='--inv-fbgskK'><field name='VALUE'>var</field></block></value><value name='OPERAND2'><shadow type='text'><field name='TEXT'></field></shadow><block type='argument_reporter_string_number' id='--inv-IiziDr'><field name='VALUE'>expr</field></block></value></block></value></block></value><statement name='SUBSTACK'><block type='data_changevariableby' id='#invariant_failure_counter'><field name='VARIABLE' variabletype=''>__inv_failure_count</field><value name='VALUE'><shadow type='text'><field name='TEXT'>1</field></shadow></value></block></statement></block></next></block></xml>"}]},"project_metrics":{"locs":23,"num_procedures":0,"num_scripts":3,"num_smells":1,"num_scriptables":2,"num_vars":3,"num_blocks":29,"num_refactorables":1}};
        // return cache;
        return sendRequestFunc(this.projectId);
    }

    renderRefactorables(refactorables, json) {
        return  renderRefactorableList(refactorables, json);
    }


    async switchTarget(i, selectRefactorableDom, refactoringTarget) {
        //programmatically select refactorable to execute
        selectRefactorableDom.selectedIndex = i;
        selectRefactorableDom.dispatchEvent(new Event('change'));
        //select target

        if (Scratch.vm.editingTarget.getName() != refactoringTarget) {
            console.log("switch target to:" + refactoringTarget);
            let targetId = Scratch.vm.runtime.targets.filter(t => t.getName() === refactoringTarget)[0].id;
            Blockly.Events.recordUndo = false;
            await Scratch.vm.setEditingTarget(targetId);
            Blockly.Events.recordUndo = true;
        }
    }

    async refactor(transforms, initialReport) {
//         console.log(transforms);
//         //START timer
//         const t0 = performance.now();


//         for (var action of transforms) {
//             try {
//                 await Scratch.workspace.blockTransformer.executeAction(action);
//                 //synchronous for now to make sure vm update its internal representation correclty in sequence of the applied transformation
//                 await Blockly.Events.fireNow_();
//             } catch (err) {
//                 console.log("Failed transformation:" + JSON.stringify(action));
//                 throw err;
//             }
//         }


//         //STOP timer
//         const t1 = performance.now();

//         initialReport.resp_time = t1 - t0;
//         initialReport.num_transforms = transforms.length;
        applyTransformations(transforms, initialReport);

    }

    async runProfile(initialReport) {
        let targetInvariantChecks = new Set(["block_8N7tdO","block_CDzozT"]);
        let refactorable_id = document.getElementById('improvables').value;

        let profilerRun = Scratch.ProfileRun = new ProfilerRun({ vm: Scratch.vm, warmUpTime, maxRecordedTime, projectId: this.projectId, initialReport, resultDiv: this.resultDiv, targetInvariantChecks });
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
        Scratch.ProfileRun = null;
    }

    setupInvariantChecks(setupObj,invChecks){
        let actions = setupObj['actions'];
        (async () => {
                await this.refactor(actions, {});
                await this.refactor(invChecks, {});
        })();
    }

    runAll() {
        window.parent.postMessage({
            type: 'BENCH_MESSAGE_LOADING'
        }, '*');

        const projectReport = Scratch.projectReport = { "project_id": this.projectId, "improvables": [] };

        this.getAnalysisInfo(sendAnalysisRequestFun).then(json => {
            const refactorables = document.getElementById('improvables');
            let selectRefactorableDom = this.renderRefactorables(refactorables, json, projectReport);
            return { json, selectRefactorableDom };
        })
            .then(({ json, selectRefactorableDom }) => {
                Blockly.Events.recordUndo = true;
              
                if (this.manualMode) {
                    return;
                }
                (async () => {
                    projectReport['project_metrics'] = json['project_metrics'];
                    for (let i = 0; i < selectRefactorableDom.length; i++) {
                        while (Scratch.workspace.hasUndoStack()) {
                            await Scratch.workspace.undo();
                            await Blockly.Events.fireNow_();
                        }

                        let refactoringTarget = json['improvables'][i]["target"];
                        this.switchTarget(i, selectRefactorableDom, refactoringTarget);

                        let initialReport = json['improvables'][i].info;

                        let refactorable_id = initialReport.refactorable_id = selectRefactorableDom.value;
                        await this.refactor(json['improvables'][i].transforms, initialReport);
                        //setup invariant checks after done refactoring when running either before or manual
                        await this.setupInvariantChecks(json['checkSetup']);
                        
                        await this.runProfile(initialReport);

                        projectReport["improvables"].push(initialReport);

                        //clean up (undo changes)
                        // break;  // todo: remove
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


