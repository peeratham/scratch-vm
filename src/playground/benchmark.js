const projectInput = document.querySelector('input');

const manualMode = true;
let warmUpTime = 2000;
let maxRecordedTime = 3000;
const WORK_TIME = 0.75;

document.querySelector('.run').addEventListener('click', () => {
        window.location.hash = projectInput.value;
        location.reload();
    }, false);

class Refactorings {
    constructor(profiler, report) {
        this.blockIdRecords = profiler.blockIdRecords;
        this.executedBlockIds = null;
        this.stats = new IdStatView(report);
    }

    update(blockIdRecords) {
        const failures = Object.keys(blockIdRecords).filter(k => k.startsWith("__inv_failure_counter"));
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
        let covered_checks = Object.keys(this.profiler.blockIdRecords).filter(k => k.startsWith("@_invariant_check_"));
        console.log(covered_checks);
        let coverage =0.5;
        // let uncoveredChecks = new Set([...this.targetInvariantChecks].filter(x => !executedBlocks.has(x)));
        // let coverage = (this.targetInvariantChecks.size - uncoveredChecks.size) / this.targetInvariantChecks.size;
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



class RefactoringEvaluator {
    constructor(projectId, data, manualMode, resultDiv) {
        this.projectId = projectId;
        this.data = data;
        this.manualMode = manualMode;
        this.resultDiv = resultDiv
        this.analysisInfo = null;
    }
    async getAnalysisInfo() {
        let cache = {"improvables":[{"id":"WgMbA","type":"extract_var","target":"Back Deco","transforms":[],"invariants":[],"info":{},"smells":["Zq8t|iP;dqf6qq(#*+},","0;^UAm/U1efztZCHW(eX"]},{"id":"NEMdx","type":"extract_var","target":"Menu","transforms":[],"invariants":[],"info":{},"smells":["T[p5_`S-MgWeK~4Af|cs","n)^;vXv+*^cN!2XVWdK_"]},{"id":"UHtQG","type":"extract_var","target":"Menu","transforms":[],"invariants":[],"info":{},"smells":["d!?)UiNPrXJlT5r!|ar^","KLYf,_-rkvzePc[x+T`}"]},{"id":"o4MDF","type":"extract_var","target":"Menu","transforms":[],"invariants":[],"info":{},"smells":["g8(FqCWK-rU5AB^/Vq=}","TnK_p])nuw325YYlyJfO"]},{"id":"5i2AX","type":"extract_var","target":"Logo","transforms":[{"type":"VarDeclareAction","name":"renamable_varAd","id":"var_cRFF2S"},{"type":"BlockCreateAction","blockId":"block_gsUUhj","info":"data_setvariableto","block_xml":"<xml><block type='data_setvariableto' id='block_gsUUhj'><field name='VARIABLE' id='var_cRFF2S' variabletype=''>renamable_varAd</field><value name='VALUE'><shadow type='text'><field name='TEXT'>0</field></shadow><block type='operator_lt' id='EC'><value name='OPERAND1'><shadow type='text' id='xI'><field name='TEXT'></field></shadow><block type='data_variable' id='1s'><field name='VARIABLE' id='_-@%-rmp7sIjJh%1B6?P-scroll y' variabletype=''>scroll y</field></block></value><value name='OPERAND2'><shadow type='text' id='UJ'><field name='TEXT'></field></shadow><block type='operator_add' id='fw'><value name='NUM1'><shadow type='math_number' id='nu'><field name='NUM'>10</field></shadow><block type='data_variable' id='jm'><field name='VARIABLE' id='_-@%-rmp7sIjJh%1B6?P-height limit' variabletype=''>height limit</field></block></value><value name='NUM2'><shadow type='math_number' id='8u'><field name='NUM'>250</field></shadow></value></block></value></block></value></block></xml>"},{"type":"InsertBlockAction","inserted_block":"block_gsUUhj","target_block":",bS)n1]kNNvB29Ns#mZj"},{"type":"BlockCreateAction","blockId":"ndXDzO","info":"operator_equals","block_xml":"<xml><block type='operator_equals' id='ndXDzO'><value name='OPERAND1'><shadow type='text'><field name='TEXT'/></shadow><block type='data_variable' id='block_LV73sz'><field name='VARIABLE' id='var_cRFF2S' variabletype=''>renamable_varAd</field></block></value><value name='OPERAND2'><shadow type='text'><field name='TEXT'>true</field></shadow></value></block></xml>"},{"type":"ReplaceAction","target_block":"K_OoF/clHo179g{Xc(~N","replace_with":"ndXDzO"},{"type":"BlockCreateAction","blockId":"DFVDEO","info":"operator_equals","block_xml":"<xml><block type='operator_equals' id='DFVDEO'><value name='OPERAND1'><shadow type='text'><field name='TEXT'/></shadow><block type='data_variable' id='block_E6rXiN'><field name='VARIABLE' id='var_cRFF2S' variabletype=''>renamable_varAd</field></block></value><value name='OPERAND2'><shadow type='text'><field name='TEXT'>true</field></shadow></value></block></xml>"},{"type":"ReplaceAction","target_block":"o0BI=gN2^kV;.y]tOS7K","replace_with":"DFVDEO"}],"invariants":[{"type":"BlockCreateAction","blockId":"@_invariant_check_t7e7yC","info":"procedures_call","block_xml":"<xml><block type='procedures_call' id='@_invariant_check_t7e7yC'><mutation proccode='assertEquals %s %s' argumentids='[&quot;varId&quot;,&quot;exprRootId&quot;]' warp='null'/><value name='varId'><shadow type='text'><field name='TEXT'></field></shadow><block type='data_variable'><field name='VARIABLE' id='var_cRFF2S' variabletype=''>renamable_varAd</field></block></value><value name='exprRootId'><shadow type='text'><field name='TEXT'></field></shadow><block type='operator_lt' id='71'><value name='OPERAND1'><shadow type='text' id='NO'><field name='TEXT'></field></shadow><block type='data_variable' id='qc'><field name='VARIABLE' id='_-@%-rmp7sIjJh%1B6?P-scroll y' variabletype=''>scroll y</field></block></value><value name='OPERAND2'><shadow type='text' id='ge'><field name='TEXT'></field></shadow><block type='operator_add' id='59'><value name='NUM1'><shadow type='math_number' id='Ni'><field name='NUM'>10</field></shadow><block type='data_variable' id='hU'><field name='VARIABLE' id='_-@%-rmp7sIjJh%1B6?P-height limit' variabletype=''>height limit</field></block></value><value name='NUM2'><shadow type='math_number' id='vS'><field name='NUM'>250</field></shadow></value></block></value></block></value></block></xml>"},{"type":"InsertBlockAction","inserted_block":"@_invariant_check_t7e7yC","target_block":"1wt+)AC|]dIr`KCb%bl{"},{"type":"BlockCreateAction","blockId":"@_invariant_check_RLN1RE","info":"procedures_call","block_xml":"<xml><block type='procedures_call' id='@_invariant_check_RLN1RE'><mutation proccode='assertEquals %s %s' argumentids='[&quot;varId&quot;,&quot;exprRootId&quot;]' warp='null'/><value name='varId'><shadow type='text'><field name='TEXT'></field></shadow><block type='data_variable'><field name='VARIABLE' id='var_cRFF2S' variabletype=''>renamable_varAd</field></block></value><value name='exprRootId'><shadow type='text'><field name='TEXT'></field></shadow><block type='operator_lt' id='uV'><value name='OPERAND1'><shadow type='text' id='HY'><field name='TEXT'></field></shadow><block type='data_variable' id='91'><field name='VARIABLE' id='_-@%-rmp7sIjJh%1B6?P-scroll y' variabletype=''>scroll y</field></block></value><value name='OPERAND2'><shadow type='text' id='8y'><field name='TEXT'></field></shadow><block type='operator_add' id='Vg'><value name='NUM1'><shadow type='math_number' id='W0'><field name='NUM'>10</field></shadow><block type='data_variable' id='Mk'><field name='VARIABLE' id='_-@%-rmp7sIjJh%1B6?P-height limit' variabletype=''>height limit</field></block></value><value name='NUM2'><shadow type='math_number' id='U6'><field name='NUM'>250</field></shadow></value></block></value></block></value></block></xml>"},{"type":"InsertBlockAction","inserted_block":"@_invariant_check_RLN1RE","target_block":",bS)n1]kNNvB29Ns#mZj"}],"info":{"num_blocks":539,"analysis_time":216,"expr_clone_group_size":2,"expr_clone_size":5,"num_blocks_changed":0},"smells":[]},{"id":"tXXkg","type":"extract_var","target":"Exit Level","transforms":[],"invariants":[],"info":{},"smells":["mbR1s~X?N_^%^q%~I(Rj","iCFmWFDN9?bu*}mt!_#~"]},{"id":"mGGEf","type":"extract_var","target":"Birdy","transforms":[],"invariants":[],"info":{},"smells":["/R_oFhbtz=#Ez2GSq?[)","l/m-Q])[X2UQG=GG=5A7"]}],"checkSetup":{"actions":[{"type":"VarDeclareAction","name":"__inv_failure_count","id":"__inv_failure_count"},{"type":"BlockCreateAction","blockId":null,"info":null,"block_xml":"<xml><block type='procedures_definition' id='assertEqualID'><value name='custom_block'><shadow type='procedures_prototype' id='nEy2N'><mutation proccode='assertEquals %s %s' argumentids='[&quot;varId&quot;,&quot;exprRootId&quot;]' argumentnames='[&quot;var&quot;,&quot;expr&quot;]' argumentdefaults='[&quot;&quot;,&quot;&quot;]' warp='false'/><value name='varId'><shadow type='argument_reporter_string_number' id='bF7Vzl'><field name='VALUE'>var</field></shadow></value><value name='exprRootId'><shadow type='argument_reporter_string_number' id='RgGmIN'><field name='VALUE'>expr</field></shadow></value></shadow></value><next><block type='control_if' id='VJPMFk'><value name='CONDITION'><block type='operator_not' id='yu2qrJ'><value name='OPERAND'><shadow type='text'><field name='TEXT'></field></shadow><block type='operator_equals' id='CvTCOE'><value name='OPERAND1'><shadow type='text'><field name='TEXT'></field></shadow><block type='argument_reporter_string_number' id='--inv-PDpxI4'><field name='VALUE'>var</field></block></value><value name='OPERAND2'><shadow type='text'><field name='TEXT'></field></shadow><block type='argument_reporter_string_number' id='--inv-ukYrV8'><field name='VALUE'>expr</field></block></value></block></value></block></value><statement name='SUBSTACK'><block type='data_changevariableby'><field name='VARIABLE' variabletype=''>__inv_failure_count</field><value name='VALUE'><shadow type='text'><field name='TEXT'>1</field></shadow></value></block></statement></block></next></block></xml>"}]},"project_metrics":{"num_failed_preconds":6,"num_procedures":3,"locs":382,"num_scripts":57,"num_smells":7,"num_scriptables":10,"num_vars":29,"num_blocks":539,"num_refactorables":7}};

        return cache;

        if (this.analysisInfo) {
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
                "type": "duplicate-expression",
                'evalMode': false
            },
            body: xml,
        });

        this.analysisInfo = response.json();

        return this.analysisInfo;
    }

    renderRefactorables(refactorables, json) {
        if (json.error != null) {
            console.log(JSON.stringify(json.error));
            return;
        }else{
            Scratch.json = json; 
        }
        
        var refactorableData = json['improvables'];
        let refactorableKV = Scratch.refactorableKV = {};

        for (let i = 0; i < refactorableData.length; i++) {
            refactorableKV[refactorableData[i].id] = refactorableData[i];
            const refactorable = document.createElement('option');
            refactorable.setAttribute('value', refactorableData[i].id);

            refactorable.appendChild(
                document.createTextNode(refactorableData[i].target + ":" + refactorableData[i].id)
            );

            refactorables.appendChild(refactorable);
        }

        refactorables.onchange = () => {
            if (!this.manualMode) {
                return;
            }

            // populate changes walk through
            let changesWalkThrough = document.getElementById('changesWalkThrough');
            while (changesWalkThrough.firstChild) { //clear
                changesWalkThrough.removeChild(changesWalkThrough.firstChild);
            }
            let improvable = refactorableKV[refactorables.value]
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

            //populate field to report safety evaluation data
            const failButton = document.getElementById("markAsFailButton");
            const comment = document.getElementById("comment");
            
            failButton.addEventListener("click", function(){
                const idInput = document.getElementById("projectIdInput");
                
                let refactorable_id = document.getElementById('improvables').value;
                let initialReport = {refactorable_id:refactorable_id};
                // let improvable = projectReport.improvables.find((itm)=>itm.refactorable_id===refactorable_id)||{};
                initialReport.predicted = improvable.transforms.length? "pass":"fail";
                initialReport.actual = "fail";//override
                
                initialReport.comment = comment.value;
                
                Scratch.projectReport["improvables"].push(initialReport);
                return;
            });

            // initialReport.predicted = Scratch.refactorableKV[refactorable_id].transforms.length? "pass":"fail";
            // initialReport.actual = initialReport.predicted;  //by default need override manually


            console.log(refactorables.value);
            // console.log(refactorableKV[refactorables.value]);

            (async () => {
                //undo from previous refactoring transformation if applicable
                while (Scratch.workspace.hasUndoStack()) {
                    await Scratch.workspace.undo();
                    await Blockly.Events.fireNow_();
                    // await Scratch.vm.emitWorkspaceUpdate();
                }


                let refactorable = refactorableKV[refactorables.value];
                let refactoringTarget = refactorable["target"];
                // this.switchTarget(refactorables.selectedIndex, refactorables, refactoringTarget);
                if (Scratch.vm.editingTarget.getName() != refactoringTarget) {
                    console.log("switch target to:" + refactoringTarget);
                    let targetId = Scratch.vm.runtime.targets.filter(t => t.getName() === refactoringTarget)[0].id;
                    Blockly.Events.recordUndo = false;
                    Scratch.vm.setEditingTarget(targetId);
                }

                let report = {};
                Blockly.Events.recordUndo = true;
                if(refactorable.transforms.length==0){
                    return;
                }
                try {
                    await this.refactor(refactorable.transforms, report);
                    //setup invariant checks after done refactoring when running either before or manual
                    await this.setupInvariantChecks(json['checkSetup'], refactorable.invariants);

                } catch (err) {
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



            })();

        };

        return refactorables;
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

        this.getAnalysisInfo().then(json => {
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


