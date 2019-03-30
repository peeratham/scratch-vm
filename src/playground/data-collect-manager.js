const isTest = true;
var testProjects = [
    { _id: '279580169' },
    { _id: '276787858' }
];

var app = angular.module('myApp', []);

app.controller('analysisTaskController', async function ($scope, $http) {
    $scope.projects = {};
    if (isTest) {
        $scope.projects = testProjects;
    }

    const frame = document.getElementsByTagName('iframe')[0];
    window.addEventListener("message", async function (message) {
        if(!message.data){
            return;
        }

        const { project_id, status } = message.data;
        
        if (status === "START") {
            let nextProjectId = $scope.projects[0]._id; //first projectId in the list
            frame.contentWindow.location.assign(`data-collect.html#${nextProjectId}`);
        } 
        if (status === "COMPLETE") {
            console.log(project_id, " : ", status);
            $scope.projects.shift();    //remove id from front
            if($scope.projects.length>0){
                let nextProjectId = $scope.projects[0]._id;
                frame.contentWindow.location.assign(`data-collect.html#${nextProjectId}`);
            }
        }
    });

    //start!

    window.parent.postMessage({
        status: 'START'
    }, '*');
    
});