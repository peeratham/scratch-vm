
// Receipt of new list of targets, selected target update.
const selectedTarget = document.getElementById('selectedTarget');
selectedTarget.onchange = async function () {
    Blockly.Events.recordUndo = false;
    await Scratch.vm.setEditingTarget(this.value);
    Blockly.Events.recordUndo = true;
};


const profileButton = document.getElementById("profile");
profileButton.addEventListener("click", async function(){
    const projectReport = Scratch.projectReport =  { "project_id": Project.ID, "improvables": [] };
    
    let targetInvariantChecks = new Set(["block_TKnelX","block_kEPt4r"]);

    document.getElementById('improvables').value
    let refactorable_id = document.getElementById('improvables').value;
    projectReport['project_metrics'] = Scratch.json['project_metrics'];

    let initialReport = {};
    if(Scratch.refactorableKV[refactorable_id]){
        initialReport = Scratch.refactorableKV[refactorable_id].info;
    }
    //todo: passing in resultDiv or instance of object rendering result
    const resultDiv = document.getElementById('profile-refactoring-result');
    
    let profilerRun = Scratch.ProfileRun = new ProfilerRun({ vm: Scratch.vm, warmUpTime, maxRecordedTime:maxRecordedTime, projectId: Project.ID, initialReport:initialReport, resultDiv: resultDiv, targetInvariantChecks });
    await profilerRun.run();
    console.log("coverage:" + profilerRun.coverage());
    
    //prepare final report for this refactoring
    profilerRun.stats.update(profilerRun.profiler.blockIdRecords);
    profilerRun.resultTable.render();
    
    initialReport.refactorable_id = refactorable_id;

    console.log(initialReport);
    projectReport["improvables"].push(initialReport);

    //get some extra info from check box etc. notes
    //send it to suite!
    const doneButton = document.getElementById("done");
    doneButton.addEventListener("click", function(){
        window.parent.postMessage({
            type: 'BENCH_MESSAGE_COMPLETE',
            projectReport: projectReport
        }, '*');
    });
});