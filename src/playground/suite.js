const soon = (() => {
    let _soon;
    return () => {
        if (!_soon) {
            _soon = Promise.resolve()
                .then(() => {
                    _soon = null;
                });
        }
        return _soon;
    };
})();

class Emitter {
    constructor() {
        Object.defineProperty(this, '_listeners', {
            value: {},
            enumerable: false
        });
    }
    on(name, listener, context) {
        if (!this._listeners[name]) {
            this._listeners[name] = [];
        }

        this._listeners[name].push(listener, context);
    }
    off(name, listener, context) {
        if (this._listeners[name]) {
            if (listener) {
                for (let i = 0; i < this._listeners[name].length; i += 2) {
                    if (
                        this._listeners[name][i] === listener &&
                        this._listeners[name][i + 1] === context) {
                        this._listeners[name].splice(i, 2);
                        i -= 2;
                    }
                }
            } else {
                for (let i = 0; i < this._listeners[name].length; i += 2) {
                    if (this._listeners[name][i + 1] === context) {
                        this._listeners[name].splice(i, 2);
                        i -= 2;
                    }
                }
            }
        }
    }
    emit(name, ...args) {
        if (this._listeners[name]) {
            for (let i = 0; i < this._listeners[name].length; i += 2) {
                this._listeners[name][i].call(this._listeners[name][i + 1] || this, ...args);
            }
        }
    }
}

class BenchFrameStream extends Emitter {
    constructor(frame) {
        super();

        this.frame = frame;
        window.addEventListener('message', message => {
            this.emit('message', message.data);
        });
    }

    send(message) {
        this.frame.send(message);
    }
}

const benchmarkUrlArgs = args => (
    [
        args.projectId,
        args.warmUpTime,
        args.recordingTime
    ].join(',')
);

const BENCH_MESSAGE_TYPE = {
    INACTIVE: 'BENCH_MESSAGE_INACTIVE',
    LOAD: 'BENCH_MESSAGE_LOAD',
    LOADING: 'BENCH_MESSAGE_LOADING',
    WARMING_UP: 'BENCH_MESSAGE_WARMING_UP',
    ACTIVE: 'BENCH_MESSAGE_ACTIVE',
    COMPLETE: 'BENCH_MESSAGE_COMPLETE'
};

class BenchUtil {
    constructor(frame) {
        this.frame = frame;
        this.benchStream = new BenchFrameStream(frame);
    }

    setFrameLocation(url) {
        this.frame.contentWindow.location.assign(url);
    }

    startBench(args) {
        this.benchArgs = args;
        this.setFrameLocation(`index.html#${benchmarkUrlArgs(args)}`);
    }

    pauseBench() {
        new Promise(resolve => setTimeout(resolve, 1000))
            .then(() => {
                this.benchStream.emit('message', {
                    type: BENCH_MESSAGE_TYPE.INACTIVE
                });
            });
    }

    resumeBench() {
        this.startBench(this.benchArgs);
    }

    renderResults(results) {
        const jsonResults = btoa(JSON.stringify(results));
        console.log(jsonResults);
        this.setFrameLocation(
            `index.html#view/${jsonResults}`
        );
    }
}

const BENCH_STATUS = {
    INACTIVE: 'BENCH_STATUS_INACTIVE',
    RESUME: 'BENCH_STATUS_RESUME',
    STARTING: 'BENCH_STATUS_STARTING',
    LOADING: 'BENCH_STATUS_LOADING',
    WARMING_UP: 'BENCH_STATUS_WARMING_UP',
    ACTIVE: 'BENCH_STATUS_ACTIVE',
    COMPLETE: 'BENCH_STATUS_COMPLETE'
};

class BenchResult {
    constructor({ fixture, status = BENCH_STATUS.INACTIVE, projectReport = null }) {
        this.fixture = fixture;
        this.status = status;
        this.projectReport = projectReport;
    }
}

class BenchFixture extends Emitter {
    constructor({
        projectId,
        warmUpTime = 4000,
        recordingTime = 6000
    }) {
        super();

        this.projectId = projectId;
        this.warmUpTime = warmUpTime;
        this.recordingTime = recordingTime;
    }

    get id() {
        return `${this.projectId}-${this.warmUpTime}-${this.recordingTime}`;
    }

    run(util) {
        return new Promise(resolve => {
            util.benchStream.on('message', message => {
                const result = {
                    fixture: this,
                    status: BENCH_STATUS.STARTING,
                    projectReport: null
                };
                if (message.type === BENCH_MESSAGE_TYPE.INACTIVE) {
                    result.status = BENCH_STATUS.RESUME;
                } else if (message.type === BENCH_MESSAGE_TYPE.LOADING) {
                    result.status = BENCH_STATUS.LOADING;
                } else if (message.type === BENCH_MESSAGE_TYPE.WARMING_UP) {
                    result.status = BENCH_STATUS.WARMING_UP;
                } else if (message.type === BENCH_MESSAGE_TYPE.ACTIVE) {
                    result.status = BENCH_STATUS.ACTIVE;
                } else if (message.type === BENCH_MESSAGE_TYPE.COMPLETE) {
                    result.status = BENCH_STATUS.COMPLETE;
                    result.projectReport = message.projectReport;
                    resolve(new BenchResult(result));
                    util.benchStream.off('message', null, this);
                }
                this.emit('result', new BenchResult(result));
            }, this);
            util.startBench(this);
        });
    }
}

class BenchSuiteResult extends Emitter {
    constructor({ suite, results = [] }) {
        super();

        this.suite = suite;
        this.results = results;

        if (suite) {
            suite.on('result', result => {
                if (result.status === BENCH_STATUS.COMPLETE) {
                    this.results.push(results);
                    this.emit('add', this);
                }
            });
        }
    }
}

class BenchSuite extends Emitter {
    constructor(fixtures = []) {
        super();

        this.fixtures = fixtures;
    }

    add(fixture) {
        this.fixtures.push(fixture);
    }

    run(util) {
        return new Promise(resolve => {
            const fixtures = this.fixtures.slice();
            const results = [];
            const push = result => {
                result.fixture.off('result', null, this);
                results.push(result);
            };
            const emitResult = this.emit.bind(this, 'result');
            const pop = () => {
                const fixture = fixtures.shift();
                if (fixture) {
                    fixture.on('result', emitResult, this);
                    fixture.run(util)
                        .then(push)
                        .then(pop);
                } else {
                    resolve(new BenchSuiteResult({ suite: this, results }));
                }
            };
            pop();
        });
    }
}

class BenchRunner extends Emitter {
    constructor({ frame, suite }) {
        super();

        this.frame = frame;
        this.suite = suite;
        this.util = new BenchUtil(frame);
    }

    run() {
        return this.suite.run(this.util);
    }
}

const viewNames = {
    [BENCH_STATUS.INACTIVE]: 'Inactive',
    [BENCH_STATUS.RESUME]: 'Resume',
    [BENCH_STATUS.STARTING]: 'Starting',
    [BENCH_STATUS.LOADING]: 'Loading',
    [BENCH_STATUS.WARMING_UP]: 'Warming Up',
    [BENCH_STATUS.ACTIVE]: 'Active',
    [BENCH_STATUS.COMPLETE]: 'Complete'
};

class BenchResultView {
    constructor({ result, benchUtil }) {
        this.result = result;
        this.compare = null;
        this.benchUtil = benchUtil;
        this.dom = document.createElement('div');
    }

    update(result) {
        soon().then(() => this.render(result));
    }

    resume() {
        this.benchUtil.resumeBench();
    }

    setFrameLocation(loc) {
        this.benchUtil.pauseBench();
        this.benchUtil.setFrameLocation(loc);
    }

    act(ev) {
        if (
            ev.type === 'click' &&
            ev.button === 0 &&
            !(ev.altKey || ev.ctrlKey || ev.shiftKey || ev.metaKey)
        ) {
            let target = ev.target;
            while (target && target.tagName.toLowerCase() !== 'a') {
                target = target.parentElement;
            }
            if (target && target.tagName.toLowerCase() === 'a') {
                if (target.href) {
                    this.setFrameLocation(target.href);
                    ev.preventDefault();
                }
            } else if (ev.currentTarget.classList.contains('resume')) {
                this.resume();
            }
        }
    }

    render(newResult = this.result, compareResult = this.compare) {
        const statusName = viewNames[newResult.status];

        this.dom.className = `result-view ${
            viewNames[newResult.status].toLowerCase()
            }`;
        this.dom.onclick = this.act.bind(this);
        let url = `index.html#${benchmarkUrlArgs(newResult.fixture)}`;
        if (newResult.status === BENCH_STATUS.COMPLETE) {
            url = `index.html#view/${btoa(JSON.stringify(newResult))}`;
        }

        this.dom.innerHTML = `
            <div class="fixture-project">
                <a href="${url}" target="bench_frame"
                    >${newResult.fixture.projectId}</a>
            </div>
            <div class="result-status">
                <div>${statusName}</div>
            </div>

            <div class="">
                ${newResult.projectReport ? JSON.stringify(newResult.projectReport) : ''}
            </div>
        `;

        this.result = newResult;
        return this;
    }
}

class BenchSuiteResultView {
    constructor({ runner }) {
        const { suite, util } = runner;

        this.runner = runner;
        this.suite = suite;
        this.views = {};
        this.dom = document.createElement('div');

        for (const fixture of suite.fixtures) {
            this.views[fixture.id] = new BenchResultView({
                result: new BenchResult({ fixture }),
                benchUtil: util
            });
        }

        suite.on('result', result => {
            this.views[result.fixture.id].update(result);
            console.log("update bench result view");
        });
    }

    render() {
        this.dom.innerHTML = `<div class="legend">
            <span>Project ID</span>
            <div class="result-status">
                <div>steps per second</div>
                <div>blocks per second</div>
            </div>
            <div>Description</div>
        </div>

        <div class="legend">
            <span>&nbsp;</span>
            <div class="result-status">
                <div><a href="#" onclick="window.download(this)">
                    Save Reports
                </a></div>
                <div><a href="#" onclick="window.aggregate(this)">
                    Aggregate
                </a></div>
            </div>
            <div class="result-status">
                <a href="#"><label for="compare-file">Compare Reports<input
                    id="compare-file" type="file"
                    class="compare-file"
                    accept="application/json"
                    onchange="window.upload(this)" />
                </label></a>
            </div>
        </div>`;

        for (const fixture of this.suite.fixtures) {
            this.dom.appendChild(this.views[fixture.id].render().dom);
        }


        return this;
    }
}

let suite;
let suiteView;

window.upload = function (_this) {
    if (!_this.files.length) {
        return;
    }
    const reader = new FileReader();
    reader.onload = function () {
        const report = JSON.parse(reader.result);
        Object.values(suiteView.views)
            .forEach(view => {
                const sameFixture = report.results.find(result => (
                    result.fixture.projectId ===
                    view.result.fixture.projectId &&
                    result.fixture.warmUpTime ===
                    view.result.fixture.warmUpTime &&
                    result.fixture.recordingTime ===
                    view.result.fixture.recordingTime
                ));

                if (sameFixture) {
                    if (
                        view.result && view.result.frames &&
                        view.result.frames.length > 0
                    ) {
                        view.render(view.result, sameFixture);
                    } else {
                        view.compare = sameFixture;
                    }
                }
            });
    };
    reader.readAsText(_this.files[0]);
};

window.download = function (_this) {
    const blob = new Blob([JSON.stringify({
        meta: {
            source: 'Scratch VM Benchmark Suite',
            version: 1
        },
        results: Object.values(suiteView.views)
            .map(view => view.result)
            .filter(view => view.status === BENCH_STATUS.COMPLETE)
    })], { type: 'application/json' });

    _this.download = 'scratch-vm-benchmark.json';
    _this.href = URL.createObjectURL(blob);
};

window.aggregate = function (_this) {
    


}


/**
First rename directory to replace whitespace with underscore
To create directory with the same name as the zip (without .sb3)
 and unzip each file into the created directory
find -name "* *" -type f | rename 's/ /_/g'
for x in ./*.sb3; do
  mkdir "${x%.*}" && unzip "$x" -d "${x%.*}"
done
 */
// To get a comma separated string of directory names in the current directory
// for i in $(ls -d */); do echo ${i%%/}; done | sed 's/\(.*\)/"\1"/g'|paste -d, -s -


window.onload = function () {
    suite = new BenchSuite();

    // suite.add(new BenchFixture({
    //     projectId: 'music',
    //     warmUpTime: 0,
    //     recordingTime: 2000
    // }));
    let OKprojects = [
        
    ];

    let test_projects = [
    //     "SS_Scratch_Project_10",
    //     "SS_Scratch_Project_18",
    //    "SS_Scratch_Project_8",
    //     "Scratch_Project_5",
    //     "Scratch_Project_12",
    //     "SS_Scratch_Project_14",
    //     "SS_Scratch_Project_15",
    //     "SS_Scratch_Project_16",
    //     "SS_Scratch_Project_17",
    //     "SS_Scratch_Project_9"
    ];

    let expr_clone_dataset = [
        // "expr-clone-237198187",
        // "expr-clone-246336982",
        // "expr-clone-247985310",
        // "expr-clone-249549259",

        // "expr-clone-252206906",
        // "expr-clone-235504161",
        // "expr-clone-247339697",
        // "expr-clone-251386278",
        // "expr-clone-200533899",
        // "expr-clone-202510579"
    ]

    let dataset = [
        // "small-average-art-252493776",
        // "small-average-games-239818687",
        // "small-popular-art-244029457",
        // "small-popular-games-245491698",
        // "small-popular-music-251373501",
        // "small-popular-tutorials-213968953",
        // "big-average-games-249579578",
        // "big-average-music-251941152",
        // "big-average-stories-251337677",
        // "big-popular-games-248728816",
        // "big-popular-music-250782876",
        // "big-popular-tutorials-243216409"
        // "extract-var-02",
        // "small-average-animation-251581694",
        // "small-average-art-252493776",
        // "small-average-games-239818687",
        // "small-average-stories-252223602",
        // "small-average-tutorials-251117970",
        // "small-popular-animation-250856489",
        // "small-popular-art-244029457",
        // "small-popular-games-245491698",
        // "small-popular-music-251373501",
        // "small-popular-tutorials-213968953",
        // "big-average-animation-252436559",
        // "big-average-games-249579578",
        // "big-average-music-251941152",
        // "big-average-stories-251337677",
        // "big-popular-games-248728816",
        // "big-popular-music-250782876",
        // "big-popular-tutorials-243216409",
        // "big-average-animation-252436559","big-average-art-250806122","big-average-games-249579578","big-average-music-251941152","big-average-stories-251337677","big-popular-animation-245195282","big-popular-art-207536546","big-popular-games-248728816","big-popular-music-250782876","big-popular-stories-229877708","big-popular-tutorials-243216409","expr-clone-200533899","expr-clone-202510579","expr-clone-235504161","expr-clone-237198187","expr-clone-246336982","expr-clone-247339697","expr-clone-247985310","expr-clone-249549259","expr-clone-251386278","expr-clone-252206906","ScratchProject1","Scratch_Project_12","ScratchProject19","ScratchProject2",
        // "ScratchProject3","ScratchProject4","Scratch_Project_5","ScratchProject6","ScratchProject7","small-average-animation-251581694","small-average-art-252493776","small-average-games-239818687","small-average-music-252561413","small-average-stories-252223602","small-average-tutorials-251117970",
        // "small-popular-art-244029457","small-popular-games-245491698","small-popular-music-251373501","small-popular-stories-223874016","small-popular-tutorials-213968953","SS_Scratch_Project_10","SSScratchProject11","SSScratchProject13","SS_Scratch_Project_14","SS_Scratch_Project_15","SS_Scratch_Project_16","SS_Scratch_Project_17","SS_Scratch_Project_18","SS_Scratch_Project_8","SS_Scratch_Project_9"
    ]

    let extrvar_inspect_data = ['big-popular-art-207536546', 'expr-clone-235504161', 'ScratchProject6', 'ScratchProject7', 'big-popular-tutorials-243216409', 'expr-clone-237198187', 'expr-clone-247339697', 'expr-clone-246336982', 'expr-clone-251386278', 'ScratchProject4', 'expr-clone-252206906', 'ScratchProject1'];
    
    for (const proj of extrvar_inspect_data) {
        suite.add(new BenchFixture({
            projectId: proj,
            warmUpTime: 1000,
            recordingTime: 3000
        }));
    }
    
    // suite.add(new BenchFixture({
    //     projectId: 247520139,
    //     warmUpTime: 1000,
    //     recordingTime: 3000
    // }));

    // suite.add(new BenchFixture({
    //     projectId: 247507535,
    //     warmUpTime: 1000,
    //     recordingTime: 3000
    // }));






    // TODO: #1322
    // Error: Cannot create monitor for target that cannot be found by name
    // suite.add(new BenchFixture({
    //     projectId: 187694931,
    //     warmUpTime: 0,
    //     recordingTime: 5000
    // }));
    //
    // suite.add(new BenchFixture({
    //     projectId: 187694931,
    //     warmUpTime: 5000,
    //     recordingTime: 5000
    // }));

    const standard = projectId => {
        suite.add(new BenchFixture({
            projectId,
            warmUpTime: 0,
            recordingTime: 5000
        }));
    };



    // standard(219313833); // sensing_touching benchmark
    // standard(236115215); // touching color benchmark
    // standard(238750909); // bob ross painting (heavy pen stamp)

    const frame = document.getElementsByTagName('iframe')[0];
    const runner = new BenchRunner({ frame, suite });
    const resultsView = suiteView = new BenchSuiteResultView({ runner }).render();

    document.getElementsByClassName('suite-results')[0]
        .appendChild(resultsView.dom);

    runner.run();
};
