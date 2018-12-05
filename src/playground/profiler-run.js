/**
* Refactorings keep track of stats specific to refactoring both already analyzed from the server and some that are augmented
e.g. safety evaluation info.
*/
class Refactorings {
    constructor(profiler, report, coverageInfo) {
        this.blockIdRecords = profiler.blockIdRecords;
        this.executedBlockIds = null;
        this.result = {failed_invariant : false, failed_loc: []};
//         this.stats = new IdStatView(report);
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
            this.completed = this.numBlocksCovered/(this.coverageInfo.numBlocks); //need -1 when coverage check for refactored with invariant checks
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
            this.result.failed_invariant = true;
            this.result.failed_loc.push(invariantCovered.pop());
            return true;
        }
        
        // completion relative to orginal blocks not including invariant checks
        if(this.completed >= 1){
            console.log('TODO: record whether invariant is preserved for this run');
            return true;
        }

        return false;
    }
}


class ProfilerRun {
    constructor({ vm, maxRecordedTime, warmUpTime, projectId, initialReport, resultDiv, coverageInfo }) {
        this.vm = vm;
        this.maxRecordedTime = maxRecordedTime;
        this.warmUpTime = warmUpTime;
        this.projectId = projectId;
        this.report = initialReport;

        vm.runtime.enableProfiling();
        const profiler = this.profiler = vm.runtime.profiler;
        vm.runtime.profiler = null;

//         const runningStats = this.runningStats = new RunningStats(profiler);
//         const runningStatsView = this.runningStatsView = new RunningStatsView({
//             dom: document.getElementsByClassName('profile-count-group')[0],
//             runningStats,
//             maxRecordedTime
//         });

        const stats = this.stats = new Refactorings(profiler, initialReport, coverageInfo);
//         this.resultTable = new RefactoringTable({
//             containerDom: resultDiv,
//             profiler,
//             stats
//         });
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
//             if (id === stepId) {
//                 this.runningStatsView.render();
//             }
//             this.runningStats.update(id, selfTime, totalTime, arg);
            this.stats.update();
        };
        
        return new Promise((resolve, reject) => {
            var stopOnTimeLimit = setTimeout(() => {
                this.stopProfileRun();
                console.log('TODO: record result fo this.stats.result');
                this.report = this.stats.result;
                clearInterval(checkCompletion);
                resolve();
            }, 100 + this.warmUpTime + this.maxRecordedTime);

            var checkCompletion = setInterval(()=>{
                 if(this.stats.shouldStop()){
                    console.log('TODO: record result fo this.stats.result');
                    this.report = this.stats.result;
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