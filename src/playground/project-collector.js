var app = angular.module('projectCollectorApp', []);

app.controller('collectProjectTaskController', async function ($scope, $http) {
    $scope.projects = await $http({
        method: "GET",
        url: 'http://localhost:3000/projects/retrieve?start=0&end=1&limit=5'
    }).then(resp => resp.data,
        err => { console.log(err); }
    );
    $scope.$apply();

    $scope.projects.map(project=>{
        console.log(project.id);
        let projectInfo = {
            _id : project.id
        };

        $http.post('http://localhost:3000/projects', JSON.stringify(projectInfo)).then(
            function (response) {
                console.log("success:"+JSON.stringify(response));
            },function (response) {
                console.log("failed:"+JSON.stringify(response));
        });
    });



    
    console.log('TODO: save each project');
    console.log($scope.projects[0]);
    


});