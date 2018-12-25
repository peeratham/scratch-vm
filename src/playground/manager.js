const isTest = true;
var testProjects = [
    // {_id: 'test_extract_var'},
    // {_id: 'expr-clone-251386278'},
    // {_id: 'expr-clone-252206906'}
    // { _id: '254317821' }
    { _id: '272302956' },
    { _id: '265577662' }
];

var app = angular.module('myApp', []);

app.controller('analysisTaskController', async function ($scope, $http) {
    $scope.projects = {};
    $scope.projectDataStatuses = {};
    //add analysis-infos model/get remaining and updater
    $scope.analysisInfos = {
        metrics: {},
        coverage: {},
        dupexpr: {}
    };

    $scope.tasks = {
        data: true,
        coverage: false
    };
    $scope.getAnalysisInfo = function (id, analysis_name) {
        return $scope.analysisInfos[analysis_name][id] ? $scope.analysisInfos[analysis_name][id] : "";
    }

    $scope.updateAnalysisInfo = async function (id, analysis_name) {
        await $http({
            method: "GET",
            url: `${ANALYSIS_INFO_SERVICE_URL}/${analysis_name}/${id}`
        }).then(resp => {
            $scope.analysisInfos[analysis_name][id] = resp.data;
            $scope.remainingTasks[analysis_name] = filterIdsForAnalysisTask({ analysisName: analysis_name }).length;
            console.log('TODO: update remainingIds');
        },
            err => { console.log(err); }
        );
    }

    const getMissingData = function (id) {
        let res = $scope.projectDataStatuses[id];
        let missing = Object.entries(res).filter(([key, value]) => value === false).map(([key, value]) => key);
        return missing;
    }

    $scope.getDataStatusStr = function (id) {
        if ($scope.projectDataStatuses[id]) {
            let missing = getMissingData(id);
            return missing.length === 0 ? "complete" : "incomplete (" + missing + ")";
        }
        return "";
    }
    $scope.updateDataStatus = async function (id) {
        await $http({
            method: "GET",
            url: `${PROJECT_DATA_SERVICE_URL}/${id}`
        }).then(resp => $scope.projectDataStatuses[id] = resp.data)
            .then(() => {
                $scope.remainingTasks.data = getRemainingIdsForDataTask().length;
            });
    }

    let projects;

    if (isTest) {
        projects = $scope.projects = testProjects;
    } else {
        projects = $scope.projects = await $http({
            method: "GET",
            url: PROJECT_SERVICE_URL
        }).then(resp => resp.data);
    }

    const getId2Entries = async function (projects, remoteServiceURL) {
        return (await Promise.all(projects.map(p =>
            $http({
                method: "GET",
                url: `${remoteServiceURL}/${p._id}`
            }).then(resp => resp.data, err => { _id: p._id })
        ))).reduce((obj, item) => {
            if (item) { //ignore if undefined (data for the projectId not exists)
                obj[item._id] = item;
            }
            return obj;
        }, {});
    };
    // retrieving remote data
    let projectDataStatuses = $scope.projectDataStatuses = await getId2Entries(projects, PROJECT_DATA_SERVICE_URL);

    let analysisInfos = $scope.analysisInfos = {
        metrics: await getId2Entries(projects, METRICS_INFO_SERVICE_URL),
        coverage: await getId2Entries(projects, COVERAGE_INFO_SERVICE_URL),
        dupexpr: await getId2Entries(projects, DUPEXPR_INFO_SERVICE_URL)
    };


    const getRemainingIdsForDataTask = async () => projects.filter(p => getMissingData(p._id).length > 0).map(p => p._id);

    const filterIdsForAnalysisTask = ({ analysisName, reanalyzeAll = false }) => {
        if (reanalyzeAll === true) {
            return projects.map(p => p.id);
        }

        if (analysisName === 'metrics') {
            return projects.filter(p => analysisInfos.metrics[p._id] === undefined).map(p => p._id);
        }

        if (analysisName === 'coverage') {
            return projects.filter(p => analysisInfos.coverage[p._id] === undefined || analysisInfos.coverage[p._id]['info']['green_flag_coverage'] === undefined).map(p => p._id);
        }
        else if (analysisName === 'dupexpr') {
            return projects.filter(p => analysisInfos.dupexpr[p._id] === undefined || analysisInfos.coverage[p._id]['info']['green_flag_coverage'] === undefined).map(p => p._id);
            //             return ['test-blocking'];
        }
        else {
            throw new Exception("Unknown analysis: " + analysisName);
        }
    };


    $scope.remainingTasks = {
        data: getRemainingIdsForDataTask().length,
        coverage: filterIdsForAnalysisTask({ analysisName: 'coverage' }).length
    };

    $scope.$apply();

    const frame = document.getElementsByTagName('iframe')[0];
    window.addEventListener("message", async function (message) {
        const { project_id, task, status } = message.data;
        if (task === 'DATA') {
            if (status === "START" && getRemainingIdsForDataTask().length > 0) {
                let nextProjectId = getRemainingIdsForDataTask()[0];
                frame.contentWindow.location.assign(`executor-data.html#${nextProjectId}`);
            } else if (status === "COMPLETE") {
                await $scope.updateDataStatus(project_id);
                $scope.$apply();
                if ($scope.remainingTasks.data > 0) {
                    let nextProjectId = getRemainingIdsForDataTask()[0];
                    frame.contentWindow.location.assign(`executor-data.html#${nextProjectId}`);
                } else if ($scope.remainingTasks.coverage > 0) {
                    //coverage next
                    let nextProjectId = filterIdsForAnalysisTask({ analysisName: 'coverage' })[0];
                    frame.contentWindow.location.assign(`executor-coverage.html#${nextProjectId}`);
                }
            }
        }

        if (task === 'METRICS') {
            let remaining = filterIdsForAnalysisTask({ analysisName: 'metrics' });
            console.log('remaining metrics tasks:' + remaining);
            if (status === "START" && remaining.length > 0) {
                let nextProjectId = remaining[0];
                frame.contentWindow.location.assign(`executor-metrics.html#${nextProjectId}`);
            } else if (status === "COMPLETE") {
                console.log('metrics complete for' + project_id);
                await $scope.updateAnalysisInfo(project_id, 'metrics');
                $scope.$apply();
                remaining = filterIdsForAnalysisTask({ analysisName: 'metrics' }); //update remaining
                console.log('remaining task' + $scope.remainingTasks.metrics);
                if ($scope.remainingTasks.metrics > 0) {
                    let nextProjectId = remaining[0];
                    frame.contentWindow.location.assign(`executor-metrics.html#${nextProjectId}`);
                }
            }
        }

        if (task === 'COVERAGE') {
            let remaining = filterIdsForAnalysisTask({ analysisName: 'coverage' });
            console.log('remaining coverage tasks:' + remaining);
            if (status === "START" && remaining.length > 0) {
                let nextProjectId = remaining[0];
                frame.contentWindow.location.assign(`executor-coverage.html#${nextProjectId}`);
            } else if (status === "COMPLETE") {
                console.log('coverage complete for' + project_id);
                await $scope.updateAnalysisInfo(project_id, 'coverage');
                $scope.$apply();
                remaining = filterIdsForAnalysisTask({ analysisName: 'coverage' }); //update remaining
                console.log('remaining task' + $scope.remainingTasks.coverage);
                if ($scope.remainingTasks.coverage > 0) {
                    let nextProjectId = remaining[0];
                    frame.contentWindow.location.assign(`executor-coverage.html#${nextProjectId}`);
                }
            }
        }

        if (task === 'DUPEXPR') {
            let remaining = filterIdsForAnalysisTask({ analysisName: 'dupexpr' });
            if (status === "START" && remaining.length > 0) {
                let nextProjectId = remaining[0];
                frame.contentWindow.location.assign(`executor-dupexpr.html#${nextProjectId}`);
            } else if (status === "COMPLETE") {
                await $scope.updateAnalysisInfo(project_id, 'dupexpr');
                this.console.log('TODO: await $scope.updateAnalysisInfo(analysisName, project_id);'); //first change coverage task to updateCoverageInfo
                /**
                 * $scope.$apply();
                 * if ($scope.remainingTasks.dupexpr > 0) {
                    let nextProjectId = remaining[0];
                    frame.contentWindow.location.assign(`executor-dupexpr.html#${nextProjectId}`);
                }
                 */
            }
        }
    });

    //start!
    if (getRemainingIdsForDataTask().length > 0) {
        window.parent.postMessage({
            task: 'DATA',
            status: 'START'
        }, '*');
    } else if (filterIdsForAnalysisTask({ analysisName: 'metrics' }).length > 0) {
        window.parent.postMessage({
            task: 'METRICS',
            status: 'START'
        }, '*');
    } else if (filterIdsForAnalysisTask({ analysisName: 'coverage' }).length > 0) {
        window.parent.postMessage({
            task: 'COVERAGE',
            status: 'START'
        }, '*');
    } else if (filterIdsForAnalysisTask({ analysisName: 'dupexpr' }).length > 0) {
        window.parent.postMessage({
            task: 'DUPEXPR',
            status: 'START'
        }, '*');
    }

});