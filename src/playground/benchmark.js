var autoAnalyze = true;
const projectInput = document.querySelector('input');


const manualMode = true;
let warmUpTime = 0;
let maxRecordedTime = 100*1000;
const WORK_TIME = 0.75;
const invariantCheckNumStmt = 1; //the counter which may not be encountered if behavior is safe
document.querySelector('.run').addEventListener('click', () => {
        window.location.hash = projectInput.value;
        location.reload();
    }, false);


const startProfiling = async function(){
    // initialize report with server analysis info
    if(Scratch.json){ 
        // prepare initial client report
        var initialReport = {};
        var refactorable_id = document.getElementById('improvables').value;
        if(Scratch.refactorableKV[refactorable_id]){
            initialReport = Scratch.refactorableKV[refactorable_id].info;
        }
        initialReport["refactorable_id"] = refactorable_id;

         // prepare profileRun parameters
        var resultDiv = document.getElementById('profile-refactoring-result');
        var numReachableStmt = Scratch.refactorableKV[refactorable_id].coverageInfo.numBlocks;
        var coverageInfo = Scratch.refactorableKV[refactorable_id].coverageInfo;
    }
    
    let profilerRun = Scratch.ProfileRun = new ProfilerRun({ vm: Scratch.vm, warmUpTime, maxRecordedTime:maxRecordedTime, projectId: Project.ID, initialReport:initialReport, resultDiv: resultDiv, coverageInfo});
    await profilerRun.runProfiler();
    
    // if improvable is selected only
    if(Scratch.json){
        profilerRun.resultTable.render();
        window.parent.postMessage({
            type: 'INVARIANT_CHECK',
            project_id: Project.ID,
            projectReport: initialReport,
            refactorable: initialReport
        }, '*');    
    }
};

const profileButton = document.getElementById("profile");
profileButton.addEventListener("click", startProfiling);

const doneProfileForProject = function(){
   window.parent.postMessage({
            type: 'BENCH_MESSAGE_COMPLETE',
            project_id: Project.ID
        }, '*'); 
};
const doneButton = document.getElementById("done");
doneButton.addEventListener("click", doneProfileForProject);

const analyzeButton = document.getElementById("analyze");
analyzeButton.addEventListener("click", async function(){
    const idInput = document.getElementById("projectIdInput");
    let result = await sendAnalysisRequestFun(idInput.value);
    // update
    const refactorables = document.getElementById('improvables');
    renderRefactorableList(refactorables, result);

    window.parent.postMessage({
            type: 'PROJECT_METRIC',
            project_id: Project.ID,
            projectMetrics: result.project_metrics
    }, '*'); 

    //send project report once, when analyze is clicked
//     projectReport['project_metrics'] = Scratch.json['project_metrics'];
//     var projectReport = Scratch.projectReport =  { "project_id": Project.ID};


});


/**
* Refactorings keep track of stats specific to refactoring both already analyzed from the server and some that are augmented
e.g. safety evaluation info.
*/
class Refactorings {
    constructor(profiler, report, coverageInfo) {
        this.blockIdRecords = profiler.blockIdRecords;
        this.executedBlockIds = null;
        this.stats = new IdStatView(report);
        this.numBlocksCovered = 0;
        this.completed = 0;
        //TODO: totolReachableStmt
        this.coverageInfo = coverageInfo;
        this.ids = [];   //set of covered statement block ids
    }

    //update block ids that have been executed so far
    // try to keep track of unique blocks counted

    update() {
        this.ids = Object.keys(this.blockIdRecords);
        if(this.ids.length!=this.numBlocksCovered){
            this.numBlocksCovered = this.ids.length;
            this.completed = this.numBlocksCovered/(this.coverageInfo.numBlocks-invariantCheckNumStmt);
            console.log((this.completed*100)+"%");
        }
    }

    shouldStop(){
        const failed = this.ids.indexOf("#failed_inv_counter")!==-1;
        const invariantCovered = this.ids.filter(k => k.startsWith("#invariant_check_"));
        if(invariantCovered.length>0){
            //TODO: total invariants covered so far
            let percentInvariantCovered = invariantCovered.length/(this.coverageInfo.invariantIds.length);
            console.log("invariant covered: "+(percentInvariantCovered*100)+"%");
        }

        if(failed){
            this.stats.update(invariantCovered.splice(-1,1)); //object map key is in the order it was inserted
            return true;
        }
        
        // completion relative to orginal blocks not including invariant checks
        if(this.completed >= 1){
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
    constructor({ vm, maxRecordedTime, warmUpTime, projectId, initialReport, resultDiv, coverageInfo }) {
        this.vm = vm;
        this.maxRecordedTime = maxRecordedTime;
        this.warmUpTime = warmUpTime;
        this.projectId = projectId;
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

        const stats = this.stats = new Refactorings(profiler, initialReport, coverageInfo);
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
                type: 'BENCH_MESSAGE_WARMING_UP',
                project_id: this.projectId 
            }, '*');
            this.vm.greenFlag();
        }, 100);
        setTimeout(() => {
            window.parent.postMessage({
                type: 'BENCH_MESSAGE_ACTIVE',
                project_id: this.projectId 
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
        document.querySelector('[type=text]').value = fixture.projectId; 
        this.refactorings.refactorings = {};
        this.refactorings.refactorings = Object.assign(new IdStatView(), data);
    }
}


const sendAnalysisRequestFun = async function(projectId){
    switch(projectId){
        case 'bug-exprclone-01':
            return {"improvables":[{"id":"JDOnw","type":"extract_var","target":"Sprite1","transforms":[{"type":"VarDeclareAction","name":"renamable_varB4","id":"var_RE5Dtr"},{"type":"BlockCreateAction","blockId":"block_KlwZjI","info":"data_setvariableto","block_xml":"<xml><block type='data_setvariableto' id='block_KlwZjI'><field name='VARIABLE' id='var_RE5Dtr' variabletype=''>renamable_varB4</field><value name='VALUE'><shadow type='text'><field name='TEXT'>0</field></shadow><block type='operator_equals' id='sz'><value name='OPERAND1'><shadow type='text' id='3k'><field name='TEXT'></field></shadow><block type='data_variable' id='xn'><field name='VARIABLE' id='`jEk@4|i[#Fk?(8x)AV.-my variable' variabletype=''>my variable</field></block></value><value name='OPERAND2'><shadow type='text' id='t7'><field name='TEXT'>0</field></shadow></value></block></value></block></xml>"},{"type":"InsertBlockAction","inserted_block":"block_KlwZjI","target_block":",2|G7RL:FVwG/N|Wyt]V","before_target":true},{"type":"BlockCreateAction","blockId":"sab2y8","info":"operator_equals","block_xml":"<xml><block type='operator_equals' id='sab2y8'><value name='OPERAND1'><shadow type='text'><field name='TEXT'/></shadow><block type='data_variable' id='block_aFcHA3'><field name='VARIABLE' id='var_RE5Dtr' variabletype=''>renamable_varB4</field></block></value><value name='OPERAND2'><shadow type='text'><field name='TEXT'>true</field></shadow></value></block></xml>"},{"type":"ReplaceAction","target_block":"aLA/0Lj@LkwZc;C#hiWG","replace_with":"sab2y8"},{"type":"BlockCreateAction","blockId":"1d04aT","info":"operator_equals","block_xml":"<xml><block type='operator_equals' id='1d04aT'><value name='OPERAND1'><shadow type='text'><field name='TEXT'/></shadow><block type='data_variable' id='block_enWLv5'><field name='VARIABLE' id='var_RE5Dtr' variabletype=''>renamable_varB4</field></block></value><value name='OPERAND2'><shadow type='text'><field name='TEXT'>true</field></shadow></value></block></xml>"},{"type":"ReplaceAction","target_block":",%+R`!VY3Ntf`O#Rf)G8","replace_with":"1d04aT"}],"invariants":[{"type":"BlockCreateAction","blockId":"#invariant_check_pb7RSJ","info":"procedures_call","block_xml":"<xml><block type='procedures_call' id='#invariant_check_pb7RSJ'><mutation proccode='assertEquals %s %s' argumentids='[&quot;varId&quot;,&quot;exprRootId&quot;]' warp='null'/><value name='varId'><shadow type='text'><field name='TEXT'></field></shadow><block type='data_variable'><field name='VARIABLE' id='var_RE5Dtr' variabletype=''>renamable_varB4</field></block></value><value name='exprRootId'><shadow type='text'><field name='TEXT'></field></shadow><block type='operator_equals' id='vq'><value name='OPERAND1'><shadow type='text' id='2P'><field name='TEXT'></field></shadow><block type='data_variable' id='Db'><field name='VARIABLE' id='`jEk@4|i[#Fk?(8x)AV.-my variable' variabletype=''>my variable</field></block></value><value name='OPERAND2'><shadow type='text' id='An'><field name='TEXT'>0</field></shadow></value></block></value></block></xml>"},{"type":"InsertBlockAction","inserted_block":"#invariant_check_pb7RSJ","target_block":",2|G7RL:FVwG/N|Wyt]V","before_target":true},{"type":"BlockCreateAction","blockId":"#invariant_check_CKlASW","info":"procedures_call","block_xml":"<xml><block type='procedures_call' id='#invariant_check_CKlASW'><mutation proccode='assertEquals %s %s' argumentids='[&quot;varId&quot;,&quot;exprRootId&quot;]' warp='null'/><value name='varId'><shadow type='text'><field name='TEXT'></field></shadow><block type='data_variable'><field name='VARIABLE' id='var_RE5Dtr' variabletype=''>renamable_varB4</field></block></value><value name='exprRootId'><shadow type='text'><field name='TEXT'></field></shadow><block type='operator_equals' id='vq'><value name='OPERAND1'><shadow type='text' id='2P'><field name='TEXT'></field></shadow><block type='data_variable' id='Db'><field name='VARIABLE' id='`jEk@4|i[#Fk?(8x)AV.-my variable' variabletype=''>my variable</field></block></value><value name='OPERAND2'><shadow type='text' id='An'><field name='TEXT'>0</field></shadow></value></block></value></block></xml>"},{"type":"InsertBlockAction","inserted_block":"#invariant_check_CKlASW","target_block":"a?5UCjaX.Hhy19!VCHZ_","before_target":true},{"type":"BlockCreateAction","blockId":"#invariant_check_9sL9VC","info":"procedures_call","block_xml":"<xml><block type='procedures_call' id='#invariant_check_9sL9VC'><mutation proccode='assertEquals %s %s' argumentids='[&quot;varId&quot;,&quot;exprRootId&quot;]' warp='null'/><value name='varId'><shadow type='text'><field name='TEXT'></field></shadow><block type='data_variable'><field name='VARIABLE' id='var_RE5Dtr' variabletype=''>renamable_varB4</field></block></value><value name='exprRootId'><shadow type='text'><field name='TEXT'></field></shadow><block type='operator_equals' id='vq'><value name='OPERAND1'><shadow type='text' id='2P'><field name='TEXT'></field></shadow><block type='data_variable' id='Db'><field name='VARIABLE' id='`jEk@4|i[#Fk?(8x)AV.-my variable' variabletype=''>my variable</field></block></value><value name='OPERAND2'><shadow type='text' id='An'><field name='TEXT'>0</field></shadow></value></block></value></block></xml>"},{"type":"InsertBlockAction","inserted_block":"#invariant_check_9sL9VC","target_block":"}iGM=_9T+2(uEI}w8ejd","before_target":true},{"type":"BlockCreateAction","blockId":"#invariant_check_RVcyDC","info":"procedures_call","block_xml":"<xml><block type='procedures_call' id='#invariant_check_RVcyDC'><mutation proccode='assertEquals %s %s' argumentids='[&quot;varId&quot;,&quot;exprRootId&quot;]' warp='null'/><value name='varId'><shadow type='text'><field name='TEXT'></field></shadow><block type='data_variable'><field name='VARIABLE' id='var_RE5Dtr' variabletype=''>renamable_varB4</field></block></value><value name='exprRootId'><shadow type='text'><field name='TEXT'></field></shadow><block type='operator_equals' id='FE'><value name='OPERAND1'><shadow type='text' id='ne'><field name='TEXT'></field></shadow><block type='data_variable' id='Fx'><field name='VARIABLE' id='`jEk@4|i[#Fk?(8x)AV.-my variable' variabletype=''>my variable</field></block></value><value name='OPERAND2'><shadow type='text' id='Yg'><field name='TEXT'>0</field></shadow></value></block></value></block></xml>"},{"type":"InsertBlockAction","inserted_block":"#invariant_check_RVcyDC","target_block":"a?5UCjaX.Hhy19!VCHZ_","before_target":true},{"type":"BlockCreateAction","blockId":"#invariant_check_BkrgrR","info":"procedures_call","block_xml":"<xml><block type='procedures_call' id='#invariant_check_BkrgrR'><mutation proccode='assertEquals %s %s' argumentids='[&quot;varId&quot;,&quot;exprRootId&quot;]' warp='null'/><value name='varId'><shadow type='text'><field name='TEXT'></field></shadow><block type='data_variable'><field name='VARIABLE' id='var_RE5Dtr' variabletype=''>renamable_varB4</field></block></value><value name='exprRootId'><shadow type='text'><field name='TEXT'></field></shadow><block type='operator_equals' id='FE'><value name='OPERAND1'><shadow type='text' id='ne'><field name='TEXT'></field></shadow><block type='data_variable' id='Fx'><field name='VARIABLE' id='`jEk@4|i[#Fk?(8x)AV.-my variable' variabletype=''>my variable</field></block></value><value name='OPERAND2'><shadow type='text' id='Yg'><field name='TEXT'>0</field></shadow></value></block></value></block></xml>"},{"type":"InsertBlockAction","inserted_block":"#invariant_check_BkrgrR","target_block":"a?5UCjaX.Hhy19!VCHZ_","before_target":false},{"type":"BlockCreateAction","blockId":"#invariant_check_Ue6hzl","info":"procedures_call","block_xml":"<xml><block type='procedures_call' id='#invariant_check_Ue6hzl'><mutation proccode='assertEquals %s %s' argumentids='[&quot;varId&quot;,&quot;exprRootId&quot;]' warp='null'/><value name='varId'><shadow type='text'><field name='TEXT'></field></shadow><block type='data_variable'><field name='VARIABLE' id='var_RE5Dtr' variabletype=''>renamable_varB4</field></block></value><value name='exprRootId'><shadow type='text'><field name='TEXT'></field></shadow><block type='operator_equals' id='FE'><value name='OPERAND1'><shadow type='text' id='ne'><field name='TEXT'></field></shadow><block type='data_variable' id='Fx'><field name='VARIABLE' id='`jEk@4|i[#Fk?(8x)AV.-my variable' variabletype=''>my variable</field></block></value><value name='OPERAND2'><shadow type='text' id='Yg'><field name='TEXT'>0</field></shadow></value></block></value></block></xml>"},{"type":"InsertBlockAction","inserted_block":"#invariant_check_Ue6hzl","target_block":"p+me$mZQz:o]L*PR9W-B","before_target":true}],"coverageInfo":{"numBlocks":18,"invariantIds":["#invariant_check_pb7RSJ","#invariant_check_CKlASW","#invariant_check_9sL9VC","#invariant_check_RVcyDC","#invariant_check_BkrgrR","#invariant_check_Ue6hzl"]},"info":{"num_blocks":15,"analysis_time":478,"expr_clone_group_size":2,"num_blocks_changed":3,"expr_clone_size":3},"smells":[]}],"checkSetup":{"actions":[{"type":"VarDeclareAction","name":"#failed_inv_counter_var","id":"#failed_inv_counter_var"},{"type":"BlockCreateAction","blockId":null,"info":null,"block_xml":"<xml><block type='procedures_definition' id='assertEqualID'><value name='custom_block'><shadow type='procedures_prototype' id='7LeYw'><mutation proccode='assertEquals %s %s' argumentids='[&quot;varId&quot;,&quot;exprRootId&quot;]' argumentnames='[&quot;var&quot;,&quot;expr&quot;]' argumentdefaults='[&quot;&quot;,&quot;&quot;]' warp='false'/><value name='varId'><shadow type='argument_reporter_string_number' id='j0IqTQ'><field name='VALUE'>var</field></shadow></value><value name='exprRootId'><shadow type='argument_reporter_string_number' id='PX0GPw'><field name='VALUE'>expr</field></shadow></value></shadow></value><next><block type='control_if' id='fAdSkv'><value name='CONDITION'><block type='operator_not' id='Dm4hFv'><value name='OPERAND'><shadow type='text'><field name='TEXT'></field></shadow><block type='operator_equals' id='nigK6U'><value name='OPERAND1'><shadow type='text'><field name='TEXT'></field></shadow><block type='argument_reporter_string_number' id='#invariantNyS938'><field name='VALUE'>var</field></block></value><value name='OPERAND2'><shadow type='text'><field name='TEXT'></field></shadow><block type='argument_reporter_string_number' id='#invariantWfgInR'><field name='VALUE'>expr</field></block></value></block></value></block></value><statement name='SUBSTACK'><block type='data_changevariableby' id='#failed_inv_counter'><field name='VARIABLE' id='#failed_inv_counter_var' variabletype=''>#failed_inv_counter_var</field><value name='VALUE'><shadow type='text'><field name='TEXT'>1</field></shadow></value></block></statement></block></next></block></xml>"}]},"project_metrics":{"locs":8,"num_procedures":0,"num_failed_preconds":0,"num_smells":1,"num_scripts":1,"num_scriptables":2,"num_vars":1,"num_blocks":12,"num_refactorables":1}};
        case 'safe-exprclone-01':
            return {"improvables":[{"id":"myEGE","type":"extract_var","target":"Sprite1","transforms":[{"type":"VarDeclareAction","name":"renamable_vargX","id":"var_FOqYWh"},{"type":"BlockCreateAction","blockId":"block_8X3be4","info":"data_setvariableto","block_xml":"<xml><block type='data_setvariableto' id='block_8X3be4'><field name='VARIABLE' id='var_FOqYWh' variabletype=''>renamable_vargX</field><value name='VALUE'><shadow type='text'><field name='TEXT'>0</field></shadow><block type='operator_divide' id='pg'><value name='NUM1'><shadow type='math_number' id='uZ'><field name='NUM'>5000</field></shadow><block type='data_variable' id='kF'><field name='VARIABLE' id='IA!S;jg2m+$|rr[8j=C2' variabletype=''>times</field></block></value><value name='NUM2'><shadow type='math_number' id='W8'><field name='NUM'>100</field></shadow></value></block></value></block></xml>"},{"type":"InsertBlockAction","inserted_block":"block_8X3be4","target_block":"Crc4=uB2m]fCP@p4rGa)","before_target":true},{"type":"BlockCreateAction","blockId":"block_mlIgry","info":"data_variable","block_xml":"<xml><block type='data_variable' id='block_mlIgry'><field name='VARIABLE' id='var_FOqYWh' variabletype=''>renamable_vargX</field></block></xml>"},{"type":"ReplaceAction","target_block":"g30nW-@S{7c/0Z`?QBm[","replace_with":"block_mlIgry"},{"type":"BlockCreateAction","blockId":"block_d6ulNj","info":"data_variable","block_xml":"<xml><block type='data_variable' id='block_d6ulNj'><field name='VARIABLE' id='var_FOqYWh' variabletype=''>renamable_vargX</field></block></xml>"},{"type":"ReplaceAction","target_block":"(*Y`z^J!VXh4N6-^MyGO","replace_with":"block_d6ulNj"}],"invariants":[{"type":"BlockCreateAction","blockId":"#invariant_check_IrQkH2","info":"procedures_call","block_xml":"<xml><block type='procedures_call' id='#invariant_check_IrQkH2'><mutation proccode='assertEquals %s %s' argumentids='[&quot;varId&quot;,&quot;exprRootId&quot;]' warp='null'/><value name='varId'><shadow type='text'><field name='TEXT'></field></shadow><block type='data_variable'><field name='VARIABLE' id='var_FOqYWh' variabletype=''>renamable_vargX</field></block></value><value name='exprRootId'><shadow type='text'><field name='TEXT'></field></shadow><block type='operator_divide' id='NN'><value name='NUM1'><shadow type='math_number' id='nk'><field name='NUM'>5000</field></shadow><block type='data_variable' id='tH'><field name='VARIABLE' id='IA!S;jg2m+$|rr[8j=C2' variabletype=''>times</field></block></value><value name='NUM2'><shadow type='math_number' id='F0'><field name='NUM'>100</field></shadow></value></block></value></block></xml>"},{"type":"InsertBlockAction","inserted_block":"#invariant_check_IrQkH2","target_block":"@kx]W0,SnY+FFgyMRe~y","before_target":true},{"type":"BlockCreateAction","blockId":"#invariant_check_fB9oBs","info":"procedures_call","block_xml":"<xml><block type='procedures_call' id='#invariant_check_fB9oBs'><mutation proccode='assertEquals %s %s' argumentids='[&quot;varId&quot;,&quot;exprRootId&quot;]' warp='null'/><value name='varId'><shadow type='text'><field name='TEXT'></field></shadow><block type='data_variable'><field name='VARIABLE' id='var_FOqYWh' variabletype=''>renamable_vargX</field></block></value><value name='exprRootId'><shadow type='text'><field name='TEXT'></field></shadow><block type='operator_divide' id='NN'><value name='NUM1'><shadow type='math_number' id='nk'><field name='NUM'>5000</field></shadow><block type='data_variable' id='tH'><field name='VARIABLE' id='IA!S;jg2m+$|rr[8j=C2' variabletype=''>times</field></block></value><value name='NUM2'><shadow type='math_number' id='F0'><field name='NUM'>100</field></shadow></value></block></value></block></xml>"},{"type":"InsertBlockAction","inserted_block":"#invariant_check_fB9oBs","target_block":"@kx]W0,SnY+FFgyMRe~y","before_target":false},{"type":"BlockCreateAction","blockId":"#invariant_check_kPAJ3F","info":"procedures_call","block_xml":"<xml><block type='procedures_call' id='#invariant_check_kPAJ3F'><mutation proccode='assertEquals %s %s' argumentids='[&quot;varId&quot;,&quot;exprRootId&quot;]' warp='null'/><value name='varId'><shadow type='text'><field name='TEXT'></field></shadow><block type='data_variable'><field name='VARIABLE' id='var_FOqYWh' variabletype=''>renamable_vargX</field></block></value><value name='exprRootId'><shadow type='text'><field name='TEXT'></field></shadow><block type='operator_divide' id='K3'><value name='NUM1'><shadow type='math_number' id='ur'><field name='NUM'>5000</field></shadow><block type='data_variable' id='vf'><field name='VARIABLE' id='IA!S;jg2m+$|rr[8j=C2' variabletype=''>times</field></block></value><value name='NUM2'><shadow type='math_number' id='yk'><field name='NUM'>100</field></shadow></value></block></value></block></xml>"},{"type":"InsertBlockAction","inserted_block":"#invariant_check_kPAJ3F","target_block":"Crc4=uB2m]fCP@p4rGa)","before_target":true},{"type":"BlockCreateAction","blockId":"#invariant_check_3DldBT","info":"procedures_call","block_xml":"<xml><block type='procedures_call' id='#invariant_check_3DldBT'><mutation proccode='assertEquals %s %s' argumentids='[&quot;varId&quot;,&quot;exprRootId&quot;]' warp='null'/><value name='varId'><shadow type='text'><field name='TEXT'></field></shadow><block type='data_variable'><field name='VARIABLE' id='var_FOqYWh' variabletype=''>renamable_vargX</field></block></value><value name='exprRootId'><shadow type='text'><field name='TEXT'></field></shadow><block type='operator_divide' id='K3'><value name='NUM1'><shadow type='math_number' id='ur'><field name='NUM'>5000</field></shadow><block type='data_variable' id='vf'><field name='VARIABLE' id='IA!S;jg2m+$|rr[8j=C2' variabletype=''>times</field></block></value><value name='NUM2'><shadow type='math_number' id='yk'><field name='NUM'>100</field></shadow></value></block></value></block></xml>"},{"type":"InsertBlockAction","inserted_block":"#invariant_check_3DldBT","target_block":"=2k%PCf;H!dBa(wa%*:0","before_target":true}],"coverageInfo":{"numBlocks":13,"invariantIds":["#invariant_check_IrQkH2","#invariant_check_fB9oBs","#invariant_check_kPAJ3F","#invariant_check_3DldBT"]},"info":{"num_blocks":10,"analysis_time":101,"expr_clone_group_size":2,"expr_clone_size":3,"num_blocks_changed":1},"smells":[]}],"checkSetup":{"actions":[{"type":"VarDeclareAction","name":"#failed_inv_counter_var","id":"#failed_inv_counter_var"},{"type":"BlockCreateAction","blockId":null,"info":null,"block_xml":"<xml><block type='procedures_definition' id='assertEqualID'><value name='custom_block'><shadow type='procedures_prototype' id='UDbHA'><mutation proccode='assertEquals %s %s' argumentids='[&quot;varId&quot;,&quot;exprRootId&quot;]' argumentnames='[&quot;var&quot;,&quot;expr&quot;]' argumentdefaults='[&quot;&quot;,&quot;&quot;]' warp='false'/><value name='varId'><shadow type='argument_reporter_string_number' id='MHTP96'><field name='VALUE'>var</field></shadow></value><value name='exprRootId'><shadow type='argument_reporter_string_number' id='ZxM1sp'><field name='VALUE'>expr</field></shadow></value></shadow></value><next><block type='control_if' id='CUmC55'><value name='CONDITION'><block type='operator_not' id='jRfvkX'><value name='OPERAND'><shadow type='text'><field name='TEXT'></field></shadow><block type='operator_equals' id='9yidBS'><value name='OPERAND1'><shadow type='text'><field name='TEXT'></field></shadow><block type='argument_reporter_string_number' id='#invariantckHaEI'><field name='VALUE'>var</field></block></value><value name='OPERAND2'><shadow type='text'><field name='TEXT'></field></shadow><block type='argument_reporter_string_number' id='#invariantFIBaKk'><field name='VALUE'>expr</field></block></value></block></value></block></value><statement name='SUBSTACK'><block type='data_changevariableby' id='#failed_inv_counter'><field name='VARIABLE' id='#failed_inv_counter_var' variabletype=''>#failed_inv_counter_var</field><value name='VALUE'><shadow type='text'><field name='TEXT'>1</field></shadow></value></block></statement></block></next></block></xml>"}]},"project_metrics":{"num_failed_preconds":0,"num_procedures":0,"locs":4,"num_smells":1,"num_scripts":1,"num_scriptables":2,"num_blocks":9,"num_vars":2,"num_refactorables":1}}
        case 'test_blocking':
            return {"improvables":[{"id":"FTUpa","type":"extract_var","target":"Sprite1","transforms":[],"invariants":[],"coverageInfo":{"numBlocks":0,"invariantIds":[]},"info":{},"smells":["$5Y`0g5kAFF{87.8]UEJ","{29LNjX})_,mt%-7gKWD"]}],"checkSetup":{"actions":[{"type":"VarDeclareAction","name":"#failed_inv_counter_var","id":"#failed_inv_counter_var"},{"type":"BlockCreateAction","blockId":null,"info":null,"block_xml":"<xml><block type='procedures_definition' id='assertEqualID'><value name='custom_block'><shadow type='procedures_prototype' id='fhIDX'><mutation proccode='assertEquals %s %s' argumentids='[&quot;varId&quot;,&quot;exprRootId&quot;]' argumentnames='[&quot;var&quot;,&quot;expr&quot;]' argumentdefaults='[&quot;&quot;,&quot;&quot;]' warp='false'/><value name='varId'><shadow type='argument_reporter_string_number' id='vOm4wA'><field name='VALUE'>var</field></shadow></value><value name='exprRootId'><shadow type='argument_reporter_string_number' id='e9fna7'><field name='VALUE'>expr</field></shadow></value></shadow></value><next><block type='control_if' id='n0r2M1'><value name='CONDITION'><block type='operator_not' id='zMEwGL'><value name='OPERAND'><shadow type='text'><field name='TEXT'></field></shadow><block type='operator_equals' id='CK5OU8'><value name='OPERAND1'><shadow type='text'><field name='TEXT'></field></shadow><block type='argument_reporter_string_number' id='#invariantV3Sxao'><field name='VALUE'>var</field></block></value><value name='OPERAND2'><shadow type='text'><field name='TEXT'></field></shadow><block type='argument_reporter_string_number' id='#invariantl373M3'><field name='VALUE'>expr</field></block></value></block></value></block></value><statement name='SUBSTACK'><block type='data_changevariableby' id='#failed_inv_counter'><field name='VARIABLE' id='#failed_inv_counter_var' variabletype=''>#failed_inv_counter_var</field><value name='VALUE'><shadow type='text'><field name='TEXT'>1</field></shadow></value></block></statement></block></next></block></xml>"}]},"project_metrics":{"locs":23,"num_failed_preconds":1,"num_procedures":0,"num_scripts":3,"num_smells":1,"num_scriptables":2,"num_blocks":29,"num_vars":3,"num_refactorables":1}};
        case 'big-popular-tutorials-243216409':
            return {"improvables":[{"id":"vET9J","type":"extract_var","target":"Kukla2","transforms":[],"invariants":[],"coverageInfo":{"numBlocks":0,"invariantIds":[]},"info":{},"smells":["TyhZMkV[Ye)(k=we?9A[",",O71QnCDE,s{6DoD|YD9"]},{"id":"8dzNm","type":"extract_var","target":"Kukla2","transforms":[{"type":"VarDeclareAction","name":"renamable_varmt","id":"var_gAWmQc"},{"type":"BlockCreateAction","blockId":"block_AXLxnp","info":"data_setvariableto","block_xml":"<xml><block type='data_setvariableto' id='block_AXLxnp'><field name='VARIABLE' id='var_gAWmQc' variabletype=''>renamable_varmt</field><value name='VALUE'><shadow type='text'><field name='TEXT'>0</field></shadow><block type='operator_letter_of' id='3G'><value name='LETTER'><shadow type='math_whole_number' id='37'><field name='NUM'>10</field></shadow><block type='data_variable' id='dN'><field name='VARIABLE' id='Tpv!7XvcQUS@O:ii?TGs-Say_Number' variabletype=''>Say_Number</field></block></value><value name='STRING'><shadow type='text' id='2j'><field name='TEXT'></field></shadow><block type='argument_reporter_string_number' id='Su'><field name='VALUE'>Message</field></block></value></block></value></block></xml>"},{"type":"InsertBlockAction","inserted_block":"block_AXLxnp","target_block":";.yX^|R~L~M6jzgU89p1","before_target":true},{"type":"BlockCreateAction","blockId":"block_kKDk65","info":"data_variable","block_xml":"<xml><block type='data_variable' id='block_kKDk65'><field name='VARIABLE' id='var_gAWmQc' variabletype=''>renamable_varmt</field></block></xml>"},{"type":"ReplaceAction","target_block":"w`B2.!.h:@8NY%9:p|fv","replace_with":"block_kKDk65"}],"invariants":[{"type":"BlockCreateAction","blockId":"#invariant_check_xUz75G","info":"procedures_call","block_xml":"<xml><block type='procedures_call' id='#invariant_check_xUz75G'><mutation proccode='assertEquals %s %s' argumentids='[&quot;varId&quot;,&quot;exprRootId&quot;]' warp='null'/><value name='varId'><shadow type='text'><field name='TEXT'></field></shadow><block type='data_variable'><field name='VARIABLE' id='var_gAWmQc' variabletype=''>renamable_varmt</field></block></value><value name='exprRootId'><shadow type='text'><field name='TEXT'></field></shadow><block type='operator_letter_of' id='bX'><value name='LETTER'><shadow type='math_whole_number' id='jf'><field name='NUM'>10</field></shadow><block type='data_variable' id='ue'><field name='VARIABLE' id='Tpv!7XvcQUS@O:ii?TGs-Say_Number' variabletype=''>Say_Number</field></block></value><value name='STRING'><shadow type='text' id='G1'><field name='TEXT'></field></shadow><block type='argument_reporter_string_number' id='iy'><field name='VALUE'>Message</field></block></value></block></value></block></xml>"},{"type":"InsertBlockAction","inserted_block":"#invariant_check_xUz75G","target_block":";.yX^|R~L~M6jzgU89p1","before_target":true},{"type":"BlockCreateAction","blockId":"#invariant_check_eqrLg0","info":"procedures_call","block_xml":"<xml><block type='procedures_call' id='#invariant_check_eqrLg0'><mutation proccode='assertEquals %s %s' argumentids='[&quot;varId&quot;,&quot;exprRootId&quot;]' warp='null'/><value name='varId'><shadow type='text'><field name='TEXT'></field></shadow><block type='data_variable'><field name='VARIABLE' id='var_gAWmQc' variabletype=''>renamable_varmt</field></block></value><value name='exprRootId'><shadow type='text'><field name='TEXT'></field></shadow><block type='operator_letter_of' id='bX'><value name='LETTER'><shadow type='math_whole_number' id='jf'><field name='NUM'>10</field></shadow><block type='data_variable' id='ue'><field name='VARIABLE' id='Tpv!7XvcQUS@O:ii?TGs-Say_Number' variabletype=''>Say_Number</field></block></value><value name='STRING'><shadow type='text' id='G1'><field name='TEXT'></field></shadow><block type='argument_reporter_string_number' id='iy'><field name='VALUE'>Message</field></block></value></block></value></block></xml>"},{"type":"InsertBlockAction","inserted_block":"#invariant_check_eqrLg0","target_block":"faHp?Vp.tUIHb)]]w52q","before_target":true}],"coverageInfo":{"numBlocks":186,"invariantIds":["#invariant_check_xUz75G","#invariant_check_eqrLg0"]},"info":{"num_blocks":263,"analysis_time":132,"expr_clone_group_size":1,"expr_clone_size":3,"num_blocks_changed":2},"smells":[]},{"id":"rp2aY","type":"extract_var","target":"stand","transforms":[],"invariants":[],"coverageInfo":{"numBlocks":0,"invariantIds":[]},"info":{},"smells":["E,7{pLM`}`7`j0;K4z]!","]U=IOc:i+AO#G06I[Lsf"]},{"id":"IowuC","type":"extract_var","target":"stand","transforms":[{"type":"VarDeclareAction","name":"renamable_varhV","id":"var_qbGvwu"},{"type":"BlockCreateAction","blockId":"block_ALbWkE","info":"data_setvariableto","block_xml":"<xml><block type='data_setvariableto' id='block_ALbWkE'><field name='VARIABLE' id='var_qbGvwu' variabletype=''>renamable_varhV</field><value name='VALUE'><shadow type='text'><field name='TEXT'>0</field></shadow><block type='operator_letter_of' id='W3'><value name='LETTER'><shadow type='math_whole_number' id='ru'><field name='NUM'>10</field></shadow><block type='data_variable' id='ts'><field name='VARIABLE' id='.SDzq0pS^#m94@8CfW`W-Say_Number' variabletype=''>Say_Number</field></block></value><value name='STRING'><shadow type='text' id='jZ'><field name='TEXT'></field></shadow><block type='argument_reporter_string_number' id='n3'><field name='VALUE'>Message</field></block></value></block></value></block></xml>"},{"type":"InsertBlockAction","inserted_block":"block_ALbWkE","target_block":"YNHP4Tt{X/%=HOd%/w9S","before_target":true},{"type":"BlockCreateAction","blockId":"block_rkhKdA","info":"data_variable","block_xml":"<xml><block type='data_variable' id='block_rkhKdA'><field name='VARIABLE' id='var_qbGvwu' variabletype=''>renamable_varhV</field></block></xml>"},{"type":"ReplaceAction","target_block":"G,cuN+=;+{?cq9M=p;0{","replace_with":"block_rkhKdA"}],"invariants":[{"type":"BlockCreateAction","blockId":"#invariant_check_ppDAfn","info":"procedures_call","block_xml":"<xml><block type='procedures_call' id='#invariant_check_ppDAfn'><mutation proccode='assertEquals %s %s' argumentids='[&quot;varId&quot;,&quot;exprRootId&quot;]' warp='null'/><value name='varId'><shadow type='text'><field name='TEXT'></field></shadow><block type='data_variable'><field name='VARIABLE' id='var_qbGvwu' variabletype=''>renamable_varhV</field></block></value><value name='exprRootId'><shadow type='text'><field name='TEXT'></field></shadow><block type='operator_letter_of' id='DO'><value name='LETTER'><shadow type='math_whole_number' id='bl'><field name='NUM'>10</field></shadow><block type='data_variable' id='Hd'><field name='VARIABLE' id='.SDzq0pS^#m94@8CfW`W-Say_Number' variabletype=''>Say_Number</field></block></value><value name='STRING'><shadow type='text' id='Kq'><field name='TEXT'></field></shadow><block type='argument_reporter_string_number' id='70'><field name='VALUE'>Message</field></block></value></block></value></block></xml>"},{"type":"InsertBlockAction","inserted_block":"#invariant_check_ppDAfn","target_block":"YNHP4Tt{X/%=HOd%/w9S","before_target":true},{"type":"BlockCreateAction","blockId":"#invariant_check_rmv3Ke","info":"procedures_call","block_xml":"<xml><block type='procedures_call' id='#invariant_check_rmv3Ke'><mutation proccode='assertEquals %s %s' argumentids='[&quot;varId&quot;,&quot;exprRootId&quot;]' warp='null'/><value name='varId'><shadow type='text'><field name='TEXT'></field></shadow><block type='data_variable'><field name='VARIABLE' id='var_qbGvwu' variabletype=''>renamable_varhV</field></block></value><value name='exprRootId'><shadow type='text'><field name='TEXT'></field></shadow><block type='operator_letter_of' id='DO'><value name='LETTER'><shadow type='math_whole_number' id='bl'><field name='NUM'>10</field></shadow><block type='data_variable' id='Hd'><field name='VARIABLE' id='.SDzq0pS^#m94@8CfW`W-Say_Number' variabletype=''>Say_Number</field></block></value><value name='STRING'><shadow type='text' id='Kq'><field name='TEXT'></field></shadow><block type='argument_reporter_string_number' id='70'><field name='VALUE'>Message</field></block></value></block></value></block></xml>"},{"type":"InsertBlockAction","inserted_block":"#invariant_check_rmv3Ke","target_block":"ao=2qq=*u6nxaBOu,.H{","before_target":true}],"coverageInfo":{"numBlocks":186,"invariantIds":["#invariant_check_ppDAfn","#invariant_check_rmv3Ke"]},"info":{"num_blocks":263,"analysis_time":132,"expr_clone_group_size":1,"expr_clone_size":3,"num_blocks_changed":2},"smells":[]}],"checkSetup":{"actions":[{"type":"VarDeclareAction","name":"#failed_inv_counter_var","id":"#failed_inv_counter_var"},{"type":"BlockCreateAction","blockId":null,"info":null,"block_xml":"<xml><block type='procedures_definition' id='assertEqualID'><value name='custom_block'><shadow type='procedures_prototype' id='Zn4dD'><mutation proccode='assertEquals %s %s' argumentids='[&quot;varId&quot;,&quot;exprRootId&quot;]' argumentnames='[&quot;var&quot;,&quot;expr&quot;]' argumentdefaults='[&quot;&quot;,&quot;&quot;]' warp='false'/><value name='varId'><shadow type='argument_reporter_string_number' id='LbP78n'><field name='VALUE'>var</field></shadow></value><value name='exprRootId'><shadow type='argument_reporter_string_number' id='2L9tGs'><field name='VALUE'>expr</field></shadow></value></shadow></value><next><block type='control_if' id='9yVmSC'><value name='CONDITION'><block type='operator_not' id='VtcGuw'><value name='OPERAND'><shadow type='text'><field name='TEXT'></field></shadow><block type='operator_equals' id='Pq4QFL'><value name='OPERAND1'><shadow type='text'><field name='TEXT'></field></shadow><block type='argument_reporter_string_number' id='#invariantWbLM3h'><field name='VALUE'>var</field></block></value><value name='OPERAND2'><shadow type='text'><field name='TEXT'></field></shadow><block type='argument_reporter_string_number' id='#invariantOAUtlh'><field name='VALUE'>expr</field></block></value></block></value></block></value><statement name='SUBSTACK'><block type='data_changevariableby' id='#failed_inv_counter'><field name='VARIABLE' id='#failed_inv_counter_var' variabletype=''>#failed_inv_counter_var</field><value name='VALUE'><shadow type='text'><field name='TEXT'>1</field></shadow></value></block></statement></block></next></block></xml>"}]},"project_metrics":{"num_failed_preconds":2,"locs":185,"num_procedures":3,"num_smells":4,"num_scripts":25,"num_scriptables":8,"num_blocks":261,"num_vars":22,"num_refactorables":4}};
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


const renderRefactorableList = async function(refactorables, json){
    if (json.error != null) {
        console.log(JSON.stringify(json.error));
        return;
    }else{
        Scratch.json = json; 
    }
    
    var refactorableData = json['improvables'];
    let refactorableKV = Scratch.refactorableKV = {};

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




const autoAnalyzeProject = async function(){
    autoAnalyze = true;
    
    const idInput = document.getElementById("projectIdInput");
    let json = await sendAnalysisRequestFun(idInput.value);
    // update
    const selectRefactorableDom = document.getElementById('improvables');
    
    if(selectRefactorableDom.firstChild==null){
        await renderRefactorableList(selectRefactorableDom, json);
        window.parent.postMessage({
                type: 'PROJECT_METRIC',
                project_id: Project.ID,
                projectMetrics: json.project_metrics
        }, '*');
    }

    (async () => {
        for (let i = 0; i < selectRefactorableDom.length; i++) {
            selectRefactorableDom.selectedIndex = i;
            selectRefactorableDom.dispatchEvent(new Event('change'));
            let refactorable = Scratch.refactorableKV[selectRefactorableDom.value];

            //todo skip if no transforms
            if(refactorable.transforms.length>0){
                await startProfiling();    
            }
            // await sleep(1000);
        }
    })().then(()=>{
        doneProfileForProject();    
    });

};

const autoAnalyzeButton = document.getElementById("auto-analyze");
autoAnalyzeButton.addEventListener("click", autoAnalyzeProject);