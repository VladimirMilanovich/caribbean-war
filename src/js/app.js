var caribbeanWarApp = angular.module('caribbean-war', [
	'ui.router',
    'ngResource',
    'pascalprecht.translate'
]);

caribbeanWarApp.constant('appConfig', {
    languages: [
        {id: 0, label:'English', code:'en-EN'},
        {id: 1, label:'Русский', code:'ru-RU'},
        {id: 2, label:'Zulu', code:'zu-ZU'}/*,
        {id: '', label:'', code: ''}*/
    ]
});

caribbeanWarApp.config(['$translateProvider', 'appConfig', function($translateProvider, appConfig) {
    $translateProvider.useStaticFilesLoader({
        prefix: 'locale/langs/',
        suffix: '.json'
    });
    $translateProvider.preferredLanguage(localStorage.locale || appConfig.languages[0].code);
}]);

caribbeanWarApp.config(function($stateProvider, $urlRouterProvider){

	$urlRouterProvider.otherwise('login');
    
    $stateProvider
        .state('login', {
            url: '/login',
            templateUrl: 'js/pages/login/login-layer.html',
            controller:"loginCtrl"
        })

        .state('harbor', {
     		url: '/harbor',
            templateUrl: 'js/pages/harbor/harbor-layer.html',
            controller:"harborCtrl"
        })

        .state('world', {
     		url: '/world',
            templateUrl: 'js/pages/world/world-layer.html',
            controller:"worldCtrl"
        });
});