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


class IdStatView {
    constructor(report) {    //should be name of refactoring
        this.report = report;
    }

    update(failures) {
        if (failures.length > 0) {
            this.report.success = false;
            this.report.failed_location = failures;
        }else{
            this.report.success = true;
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