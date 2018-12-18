var app = angular.module('myApp', []);

app.controller('analysisTaskController', async function ($scope, $http) {
    $scope.projects = {};
    $scope.projectDataStatuses = {};
    //add analysis-infos model/get remaining and updater
    $scope.analysisInfos = {
        coverage : {},
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
        }).then(resp => $scope.analysisInfos[analysis_name][id] = resp.data, 
                err => {console.log(err);}
        );

        $scope.remainingTasks.coverage = filterIdsForAnalysisTask({analysisName:'coverage'}).length;
    }

    const getMissingData = function(id){
        let res = $scope.projectDataStatuses[id];
        let missing = Object.entries(res).filter(([key, value]) => value===false).map(([key,value]) => key);
        return missing;
    }

    $scope.getDataStatusStr = function (id) {
        if ($scope.projectDataStatuses[id]) {
            let missing = getMissingData(id);
            return missing.length ===0 ? "complete" : "incomplete ("+missing+")";
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
    // projects = $scope.projects = await $http({
    //     method: "GET",
    //     url: PROJECT_SERVICE_URL
    // }).then(resp => resp.data);

    //test
    console.log('TODO: change back to get project list from db');
    projects =$scope.projects = [
        // {_id: 'test_extract_var'},
        // {_id: 'expr-clone-251386278'},
        // {_id: 'expr-clone-252206906'}
        {_id: '254317821'}
    ];

    const getId2Entries = async function (projects, remoteServiceURL) {
        return (await Promise.all(projects.map(p =>
            $http({
                method: "GET",
                url: `${remoteServiceURL}/${p._id}`
            }).then(resp => resp.data, err=> {_id:p._id})
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
        coverage : await getId2Entries(projects, COVERAGE_INFO_SERVICE_URL),
        dupexpr : await getId2Entries(projects, DUPEXPR_INFO_SERVICE_URL)
    };


    const getRemainingIdsForDataTask = () => projects.filter(p => getMissingData(p._id).length > 0).map(p => p._id);    

    const filterIdsForAnalysisTask = ({analysisName, reanalyzeAll=false}) => {
        if(reanalyzeAll === true){
            return projects.map(p => p.id);
        }

        if(analysisName==='coverage'){
            return projects.filter(p => analysisInfos.coverage[p._id] === undefined || analysisInfos.coverage[p._id]['info']['green_flag_coverage'] === undefined).map(p => p._id);
        }
        else if(analysisName==='dupexpr'){
            return projects.filter(p => analysisInfos.dupexpr[p._id] === undefined || analysisInfos.coverage[p._id]['info']['green_flag_coverage'] === undefined).map(p => p._id);
//             return ['test-blocking'];
        }
        else {
            throw new Exception("Unknown analysis: "+analysisName);
        }
    };


    $scope.remainingTasks = {
        data: getRemainingIdsForDataTask().length,
        coverage: filterIdsForAnalysisTask({analysisName:'coverage'}).length
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
                } else if($scope.remainingTasks.coverage > 0) {
                    //coverage next
                    let nextProjectId = filterIdsForAnalysisTask({analysisName:'coverage'})[0];
                    frame.contentWindow.location.assign(`executor-coverage.html#${nextProjectId}`);
                }
            }
        }

        if (task === 'COVERAGE') {
            let remaining = filterIdsForAnalysisTask({analysisName:'coverage'});
            if (status === "START" && remaining.length > 0) {
                let nextProjectId = remaining[0];
                frame.contentWindow.location.assign(`executor-coverage.html#${nextProjectId}`);
            } else if (status === "COMPLETE") {
                await $scope.updateAnalysisInfo(project_id, 'coverage');
                $scope.$apply();
                if ($scope.remainingTasks.coverage > 0) {
                    let nextProjectId = remaining[0];
                    frame.contentWindow.location.assign(`executor-coverage.html#${nextProjectId}`);
                }
            }
        }

        if (task === 'DUPEXPR') {
            let remaining = filterIdsForAnalysisTask({analysisName:'dupexpr'});
            if (status === "START" && remaining.length > 0){
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
    } else if (filterIdsForAnalysisTask({analysisName:'coverage'}).length > 0) {
        window.parent.postMessage({
            task: 'COVERAGE',
            status: 'START'
        }, '*');
    } else if (filterIdsForAnalysisTask({analysisName:'dupexpr'}).length > 0) {
        window.parent.postMessage({
            task: 'DUPEXPR',
            status: 'START'
        }, '*');
    }

});