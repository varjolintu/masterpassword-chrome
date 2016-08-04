/* Copyright Torbjorn Tyridal 2015

    This file is part of Masterpassword for Chrome (herby known as "the software").

    The software is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    The software is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with the software.  If not, see <http://www.gnu.org/licenses/>.
*/

(function(){
function encode_utf8(s) {
  return unescape(encodeURIComponent(s));
}
function string_is_plain_ascii(s) {
    return s.length === encode_utf8(s).length;
}

 var stored_sites={},
     username="",
     key_id,
     alg_max_version,
     alg_min_version = 1;

$('#passwdtype').on('change', function() {
    var v = $(this).val();
    chrome.storage.sync.set({ 'defaulttype': v });
    chrome.extension.getBackgroundPage().session_store.defaulttype = v;
});

function save_sites_to_backend() {
    console.log('save sites', stored_sites);
    chrome.storage.sync.set({ 'sites': stored_sites });
}

function stored_sites_table_append(domain, site, type, loginname, count, ver) {
    switch(type) {
        case 'x': type="Maximum"; break;
        case 'l': type="Long"; break;
        case 'm': type="Medium"; break;
        case 'b': type="Basic"; break;
        case 's': type="Short"; break;
        case 'i': type="Pin"; break;
        case 'n': type="Name"; break;
        case 'p': type="Phrase"; break;
        default: throw new Error("Unknown password type");
    }
    $('#stored_sites').append('<tr><td>'+site+'<td><input class="domainvalue" type="text" data-old="'+
        domain+'" value="'+domain+'"><td>'+loginname+'<td>'+count+'<td>'+type+'<td>'+ver+
        '<td><img class="delete" src="../../icons/delete.png">');
}

window.addEventListener('load', function() {
    var ss = chrome.extension.getBackgroundPage().session_store;
    stored_sites = ss.sites;
    username = ss.username;
    key_id = ss.key_id;
    alg_max_version = ss.max_alg_version;
    $('#passwdtype').val(ss.defaulttype);

    if (!string_is_plain_ascii(username)) {
        alg_min_version = Math.min(3, alg_max_version);
        if (alg_min_version > 2)
            $('#ver3note').show();
    }

    $.each(stored_sites, function(domain,v){
        $.each(v, function(site, settings){
            var alg_version = alg_min_version;
            if (alg_min_version < 3 && !string_is_plain_ascii(site))
                alg_version = 2;
            if (settings.username === undefined)
                settings.username = "";
            stored_sites_table_append(domain,
                site,
                settings.type,
                settings.username,
                settings.generation,
                ""+alg_version);
        });
    });
});

$(document).on('dragover dragenter', function(e){
    e.preventDefault();
    e.stopPropagation();
});

$('#stored_sites').on('change','.domainvalue',function(e){
    var $t = $(this), domain = $t.attr('data-old'), newdomain = $t.val(), site;
    $t.attr('data-old', newdomain);
    $t=this;
    do {
        $t = $t.parentNode;
    } while($t.nodeName !== 'TR');
    site=$($t).children('td:eq(0)').text();

    if (! (newdomain in stored_sites)) stored_sites[newdomain] = {};
    stored_sites[newdomain][site] = stored_sites[domain][site];
    delete stored_sites[domain][site];
    save_sites_to_backend();
});

$('#stored_sites').on('click','.delete',function(e){
    var $t, t = this;
    console.log(t);
    while (t.parentNode.nodeName !== 'TR') t = t.parentNode;
    if (t.parentNode.nodeName !== 'TR') throw new Error("logic error - cant find parent node");
    t=t.parentNode;
    $t=$(t);

    delete stored_sites[$t.find('td:eq(1) > input').val()][$t.children('td:eq(0)').text()];
    $(t).remove();
    save_sites_to_backend();
});

$(document).on('drop', function(e){
    e.originalEvent.dataTransfer.dropEffect='move';
    e.preventDefault();
    e.stopPropagation();
    if (e.originalEvent.dataTransfer.files.length !== 1) return;
    if (! /.*\.mpsites$/gi.test(e.originalEvent.dataTransfer.files[0].name)) {
        alert("need a .mpsites file");
        return;
    }
    var fr = new FileReader();
    fr.onload=function(x){
        var has_ver1_mb_sites = false;
        try {
            x = window.mpw_utils.read_mpsites(x.target.result, username, key_id, confirm);
            if (!x) return;
        } catch (e) {
            if (e.name === 'mpsites_import_error') {
                alert(e.message);
                return;
            }
            else throw e;
        }
        $.each(x, function(){
            var y = this.sitename.split("@");
            if (y.length > 1)
                this.sitesearch = y[y.length-1];
            else
                this.sitesearch = this.sitename;

            stored_sites_table_append(
                this.sitesearch,
                this.sitename,
                this.passtype,
                this.loginname,
                this.passcnt,
                this.passalgo);

            if (this.passalgo < 2 && !string_is_plain_ascii(this.sitename))
                has_ver1_mb_sites = true;

            if (! (this.sitesearch in stored_sites)) stored_sites[this.sitesearch] = {};
            stored_sites[this.sitesearch][this.sitename] = {
                'generation': this.passcnt,
                'type': this.passtype,
                'username': this.loginname
            };
        });

        if (has_ver1_mb_sites)
            alert("Version mismatch\n\nYour file contains site names with non ascii characters from "+
                  "an old masterpassword version. This addon can not reproduce these passwords");
        else
            console.debug('Import successful');

        save_sites_to_backend();
    };
    fr.readAsText(e.originalEvent.dataTransfer.files[0]);

});

$('body').on('click','.export_mpsites',function(){
    start_data_download(window.mpw_utils.make_mpsites(key_id, username, stored_sites, alg_min_version, alg_max_version), 'chrome.mpsites');
});

function start_data_download(stringarr,filename) {
    var a = window.document.createElement('a');
    a.href = window.URL.createObjectURL(new Blob(stringarr, {type: 'text/plain'}));
    a.download = filename;

    // Append anchor to body.
    document.body.appendChild(a);
    a.click();

    // Remove anchor from body
    document.body.removeChild(a);
}

}());
