console.log(i18n("app_name") + ": init background.js");

const Core = {

   translateProvider: {
      toText: translateAPI['Google'].toText,
      toUrl: translateAPI['Google'].toUrl,
      toWeb: translateAPI['Google'].toWeb
   },

   showNotification: (opt) => {
      const manifest = chrome.runtime.getManifest();
      let options = {
         type: opt.type || 'basic', //'basic', 'image', 'list', 'progress'
         title: opt.title || i18n("app_name"),
         iconUrl: opt.iconUrl || manifest.icons['48'],
         message: opt.message || '',
         // "priority": 2,
      };
      chrome.notifications.create('info', options, function (notificationId) {
         chrome.notifications.onClicked.addListener(function (callback) {
            chrome.notifications.clear(notificationId, callback);
         });
      });
   },

   translatePage: () => {
      chrome.tabs.query({
         active: true,
         lastFocusedWindow: true
      }, (tabs) => {
         let tab = tabs[0];
         if (Core.isLink(tab.url)) {
            Core.translateProvider.toUrl({
               to_language: Core.conf.toLang,
               url: tab.url
            });
         } else
            alert(i18n("msg_not_access_tab"));
      });
   },

   translateToNotification: (str = required()) => {
      let text = str.toString().trim();

      let dispatch = {
         from_language: Core.conf.fromLang,
         to_language: Core.conf.toLang,
         original_text: text,
      };

      if (text.length > 200) { //max notifyCallback symbols 
         Core.translateProvider.toWeb(dispatch);

      } else {
         let notifyCallback = function (params) {
            Core.showNotification ({
               title: i18n("app_short_name") + ' [' + params.detectLang /*dispatch.from_language*/ + ' > ' + dispatch.to_language + ']',
               message: params.translated_text
            });
         };
         Core.translateProvider.toText(dispatch, notifyCallback);
      }
   },

   // selectionIndicator: () => {
   //       let selected = window.getSelection().toString();
   //       // let icon = selected.length ? '' : manifest.icons['16'];
   //       let icon = selected.length ? 'y' : 'n';

   //       // chrome.browserAction.setIcon({ path: icon });
   //       chrome.browserAction.setBadgeText({ text: icon });
   // },

   createContextMenu: () => {
      chrome.contextMenus.create({
         id: 'translate-context',
         title: i18n("context_menu_selection"),
         contexts: ["selection"]
      });
      chrome.contextMenus.create({
         id: 'translate-page',
         title: i18n("context_menu_page"),
         // onclick: getword,
      });
   },

   commandRun: (commands, callback) => {
      switch (commands.command || commands) {
         case 'translate-context':
            let text = typeof callback === 'string' ? callback : false;
            Core.translateToNotification(text);
            break;
         case 'translate-hotkey':
            Core.getSelectionText(Core.translateToNotification);
            break;
         case 'translate-page':
            Core.translatePage();
            break;
         case 'setOptions':
            Core.loadDefaultSettings(commands.options);
            break;
         default:
            console.warn('Sorry, we are out of %s.', commands.command);
      }
   },

   isLink: (link) => {
      return (/http:|https:|ftp:/.test(link.split('/')[0])) ? true : false;
   },

   getSelectionText: (callback) => {
      // chrome.tabs.query({active: true, currentWindow: true}, (tab) => {
      chrome.tabs.getSelected(null, (tab) => {
         if (Core.isLink(tab.url))
            chrome.tabs.executeScript({
               code: "window.getSelection().toString()",
               allFrames: true
            }, (selection) => {

               let selected = selection.filter((x) => {
                  return (x !== (undefined || null || ''));
               });

               if (selected.length) {
                  if (callback && typeof (callback) === "function") {
                     // return callback(selection.toString());
                     callback(selection.toString());
                  }
               }
            });
      });
   },

   // Register the event handlers.
   eventListener: () => {
      chrome.contextMenus.onClicked.addListener(function (clickData, tab) {
         // console.log('clickData.menuItemId:', clickData.menuItemId);
         Core.commandRun(clickData.menuItemId, clickData.selectionText);
      });

      // hotkey
      chrome.commands.onCommand.addListener(function (onCommand) {
         console.log('onCommand: %s', onCommand);

         Core.commandRun(onCommand);
      });

      // calls
      chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
         console.log('onMessage request: %s', JSON.stringify(request));
         console.log('onMessage sender: %s', JSON.stringify(sender));

         Core.commandRun(request, sendResponse);
      });
   },

   loadDefaultSettings: (res) => {
      Core.conf = {};
      Core.conf.fromLang = res['lang-from'] && res['lang-from'].charAt(0) == '~' ? "auto" : res['lang-from'];
      Core.conf.toLang = res['lang-to'] || "en";
      console.log('loadDefaultSettings: %s', JSON.stringify(Core.conf));
   },

   init: () => {
      console.log('Core init');

      let callback = (res) => Core.loadDefaultSettings(res);
      Storage.getParams(null, callback, false);

      Core.createContextMenu();
      Core.eventListener();
   },
};

Core.init();
