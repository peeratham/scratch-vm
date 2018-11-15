const BASE_PROJECT_SERVER_URL = "http://localhost:3000";
const DATA_SERVICE_URL = BASE_PROJECT_SERVER_URL+"/data";
const PROJECT_SERVICE_URL = BASE_PROJECT_SERVER_URL+"/projects";
const ANALYSIS_INFO_SERVICE_URL = BASE_PROJECT_SERVER_URL+"/analysis-infos";

var app = angular.module('myApp', []);

app.controller('analysisTaskController', async function ($scope, $http) {
    $scope.projects = {};
    $scope.projectDataStatuses = {};
    //add analysis-infos model/get remaining and updater
    $scope.analysisInfos = {};

    $scope.tasks = {
        data: true,
        coverage: false
    };
    $scope.getAnalysisInfo = function(id,analysisType){
        return $scope.analysisInfos[id]? $scope.analysisInfos[id][analysisType] : "";
    }

    $scope.updateAnalysisInfo = async function (id) {
        await $http({
            method: "GET",
            url: `${ANALYSIS_INFO_SERVICE_URL}/${id}`
        })
        .then(resp => $scope.analysisInfos[id] = resp.data)
        .then(()=>{
            $scope.remainingTasks.coverage = getRemainingIdsForCoverageTask().length;
        });
    }

    $scope.getDataStatus = function (id) {
        if ($scope.projectDataStatuses[id]) {
            return $scope.projectDataStatuses[id]['project_dir_exists'] === true ? "complete" : "incomplete";
        }
        return "";
    }
    $scope.updateDataStatus = async function (id) {
        await $http({
            method: "GET",
            url: `${DATA_SERVICE_URL}/${id}`
        }).then(resp => $scope.projectDataStatuses[id] = resp.data)
        .then(()=>{
            $scope.remainingTasks.data = getRemainingIdsForDataTask().length;
        });
    }


    let projects = $scope.projects = await $http({
        method: "GET",
        url: PROJECT_SERVICE_URL
    }).then(resp => resp.data);

    const getId2Entries = async function(projects, remoteServiceURL){
        return (await Promise.all(projects.map(p =>
            $http({
                method: "GET",
                url: `${remoteServiceURL}/${p._id}`
            }).then(resp=>resp.data, err=>{_id:p._id})
        ))).reduce((obj, item) => { 
            if(item){
                obj[item._id] = item;
            }
            return obj; }, {});
    };
    // retrieving remote data
    let projectDataStatuses = $scope.projectDataStatuses = await getId2Entries(projects, DATA_SERVICE_URL);
    let analysisInfos = $scope.analysisInfos = await getId2Entries(projects, ANALYSIS_INFO_SERVICE_URL);
    

    const getRemainingIdsForDataTask = ()=> projects.filter(p => projectDataStatuses[p._id]['project_dir_exists'] === false).map(p => p._id);
    const getRemainingIdsForCoverageTask = () => projects.filter(p => analysisInfos[p._id]===undefined||analysisInfos[p._id]['green_flag_coverage'] === undefined).map(p => p._id);
    $scope.remainingTasks = {
        data : getRemainingIdsForDataTask().length,
        coverage: getRemainingIdsForCoverageTask().length
    };

    $scope.$apply();


    const frame = document.getElementsByTagName('iframe')[0];
    window.addEventListener("message", async function (message) {
        const { project_id, task, status } = message.data;
        if(task==='DATA'){
            if (status === "START" && getRemainingIdsForDataTask().length > 0){
                let nextProjectId = getRemainingIdsForDataTask()[0];
                frame.contentWindow.location.assign(`executor-data.html#${nextProjectId}`);
            }else if (status === "COMPLETE") {
                await $scope.updateDataStatus(project_id);
                $scope.$apply();
                if ($scope.remainingTasks.data > 0) {
                    let nextProjectId = getRemainingIdsForDataTask()[0];
                    frame.contentWindow.location.assign(`executor-data.html#${nextProjectId}`);
                }else{
                    //coverage next
                    let nextProjectId = getRemainingIdsForCoverageTask()[0];
                    frame.contentWindow.location.assign(`executor-coverage.html#${nextProjectId}`);
                }
            }
        }
        
        if(task==='COVERAGE'){
            if (status === "START" && getRemainingIdsForCoverageTask().length > 0){
                let nextProjectId = getRemainingIdsForCoverageTask()[0];
                frame.contentWindow.location.assign(`executor-coverage.html#${nextProjectId}`);
            } else if (status === "COMPLETE") {
                await $scope.updateAnalysisInfo(project_id);
                $scope.$apply();
                if ($scope.remainingTasks.coverage > 0) {
                    let nextProjectId = getRemainingIdsForCoverageTask()[0];
                    frame.contentWindow.location.assign(`executor-coverage.html#${nextProjectId}`);
                }
            }
        }
    });

    //start!
    if(getRemainingIdsForDataTask().length>0){
        window.parent.postMessage({
            task: 'DATA',
            status: 'START'
        }, '*');
    }else if(getRemainingIdsForCoverageTask().length>0){
        window.parent.postMessage({
            task: 'COVERAGE',
            status: 'START'
        }, '*');
    }

});