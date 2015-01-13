// document.getElementById('action').onclick = function() {
(function () {

function parse_uri(sourceUri){
    // stolen with pride: http://blog.stevenlevithan.com/archives/parseuri-split-url
    var uriPartNames = ["source","protocol","authority","domain","port","path","directoryPath","fileName","query","anchor"],
    uriParts = new RegExp("^(?:([^:/?#.]+):)?(?://)?(([^:/?#]*)(?::(\\d*))?)((/(?:[^?#](?![^?#/]*\\.[^?#/.]+(?:[\\?#]|$)))*/?)?([^?#/]*))?(?:\\?([^#]*))?(?:#(.*))?").exec(sourceUri),
    uri = {};
    for(var i = 0; i < 10; i++)
        uri[uriPartNames[i]] = (uriParts[i] ? uriParts[i] : "");
    if(uri.directoryPath.length > 0)
        uri.directoryPath = uri.directoryPath.replace(/\/?$/, "/");
    return uri;
}

function get_active_tab_url() {
    var ret = jQuery.Deferred();
    chrome.tabs.query({active:true,windowType:"normal",currentWindow:true}, function(tabres){
    if (tabres.length!=1) {
        $('#usermessage').html("Error: bug in tab selector");
        console.log(tabres);
        throw "plugin bug";
    } else
        ret.resolve(tabres[0].url);
    });
    return ret;
}

function copy_to_clipboard(mimetype, data) {
    document.oncopy = function(event) {
        event.clipboardData.setData(mimetype, data);
        event.preventDefault();
    };
    document.execCommand("Copy", false, null);
    document.oncopy=null;
}

var mpw=null;

function recalculate() {
    $('#usermessage').html("Please wait...");
    if ($('#sitename').val()==null || $('#sitename').val()=="") {
        $('#usermessage').html("need sitename");
        return;
    }
    if (!mpw)
        mpw = new MPW(
        chrome.extension.getBackgroundPage().session_store.username,
        chrome.extension.getBackgroundPage().session_store.masterkey);


    console.log("calc password "+$('#sitename').val()+" . "+parseInt($('#passwdgeneration').val())+" . "+$('#passwdtype').val());
    mpw.generatePassword($('#sitename').val(), parseInt($('#passwdgeneration').val()), $('#passwdtype').val())
    .then(function(pass){
        console.log('Got password');
        var i,s="";
        for (i=0;i<pass.length;i++)s+="&middot;";

        $('#thepassword').html(pass);

        copy_to_clipboard("text/plain",pass);

        $('#usermessage').html("Password for "+$('#sitename').val()+" copied to clipboard");
    });
}

function popup() {
    var recalc=false;
    if (chrome.extension.getBackgroundPage().session_store.username==null || chrome.extension.getBackgroundPage().session_store.masterkey==null) {
        $('#main').hide();
        $('#sessionsetup').show();
        if (chrome.extension.getBackgroundPage().session_store.username==null)
            $('#username').focus()
        else {
            $('#username').val(chrome.extension.getBackgroundPage().session_store.username)
            $('#masterkey').focus()
        }
    } else
        recalc=true;
    get_active_tab_url().then(function(url){
        var domain = parse_uri(url)['domain'].split("."),
            significant_parts=2;
        if (domain[domain.length-1].toLowerCase()=="uk")
            significant_parts=3;
        while(domain.length>1 && domain.length>significant_parts)domain.shift();
        domain=domain.join(".");
        $('#sitename').attr('value',domain);
        if(recalc)
            recalculate();
    });

}

$('#sessionsetup > form').on('submit', function(){
    if ($('#username').val().length < 2) {
        $('#usermessage').html('<span style="color:red">Please enter a name (>2 chars)</span>');
        $('#username').focus();
        return false;
    }
    if ($('#masterkey').val().length < 2) {
        $('#usermessage').html('<span style="color:red">Please enter a master key (>2 chars)</span>');
        $('#masterkey').focus();
        return false;
    }
    chrome.extension.getBackgroundPage().session_store.username=$('#username').val();
    chrome.extension.getBackgroundPage().session_store.masterkey=$('#masterkey').val();
    chrome.storage.sync.set({'username':chrome.extension.getBackgroundPage().session_store.username});

    $('#sessionsetup').hide();
    $('#main').show();
    recalculate();
    return false;
});

$('#generatepassword').on('click', function(){

});
$('#siteconfig_show').on('click', function(){
    $('#siteconfig').show();
    $(this).hide();
    return false;
});
$('#siteconfig').on('change','select,input',recalculate);
$('#sitename').on('change',recalculate);

window.addEventListener('load', popup,false);
}());

