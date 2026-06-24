/** @odoo-module */

import PublicWidget from "@web/legacy/js/public/public_widget";
import { jsonrpc } from "@web/core/network/rpc_service"; 
 

// odoo.define('hr_cbt_portal_recruitment.documentation_request_form', function (require) {
//     "use strict";

//     require('web.dom_ready');
//     var utils = require('web.utils');
//     var ajax = require('web.ajax');
//     var publicWidget = require('web.public.widget');
//     var core = require('web.core');
//     var qweb = core.qweb;
//     var _t = core._t;  
     
    PublicWidget.registry.DocumentationRequestFormWidgets = PublicWidget.Widget.extend({
        selector: '#documentation-request-form',
        start: function(){
            var self = this;
            return this._super.apply(this, arguments).then(function(){
                console.log("documentation request started")
               
            });

        },
        willStart: function(){
            var self = this; 
            return this._super.apply(this, arguments).then(function(){
                console.log(".....")
            })
        },
        
        events: {

            'click .button_doc_submit': function (ev) {
                // Get form
                var form = $('#msformidocs')[0];
                // FormData object 
                var formData = new FormData(form);
                var DataItems = []
                //append extra data to form
                formData.append('record_id', parseInt($('.record_id').attr('id')));
                let inputIdArray = [];
                $(`div#col-sm-docu > input.docuClass`).each(function(){
                    var main_id = $(this).attr('main_id'); 
                    var inputId = $(this).attr('id'); 

                    console.log(`the game is  `, document.getElementById(inputId).files[0])
                    let inputfile = document.getElementById(inputId).files[0]
                    if (inputfile){
                        formData.append(main_id, inputfile);
                        inputIdArray.push(main_id)
                    }
                    
                });
                formData.append('counter_ids', JSON.stringify(inputIdArray));
                console.log(formData);
                var xmlRequest = $.ajax({
                    type: "POST",
                    enctype: 'multipart/form-data',
                    url: "/document-data-process",
                    data: formData,
                    processData: false,
                    contentType: false,
                    cache: false,
                    timeout: 800000,
                    beforeSend: function () {
                        console.log('trying to upload documentation ')
                    }
                });
                xmlRequest.done(function (data) {
                    let result = JSON.stringify(data);
                    console.log(`Recieving response from server => ${result.status} //// ${result}`)
                    // if (!result.status) {
                        // alert(`Validation Error:  ${result.message}`);
                        // return false;
                    // }else{
                    window.location.href = `/documentation-success`;
                    console.log("XMLREQUEST Successful");
                    // clearing form content
                    $("#msformidocs")[0].reset();
                    $("#build_attachment").empty()
                        
                    // }
                });
                xmlRequest.fail(function (jqXHR, textStatus) {
                    console.log(`Registration. TextStatus: ${textStatus}. Statuscode:  ${jqXHR.status}`);
                });
                xmlRequest.always(function () {
                    console.log("-*");

                })
            },

           
            'click .start-documentation': async function(ev){
                let targetElement = $(ev.target).attr('id');
                let record_id = $('.record_id').attr('id');
                console.log(`Displays the form element and build dynamic rendering ${targetElement}`);
                await jsonrpc(
                    `/get-applicant-document`,
                    {
                        'record_id': record_id,
                    },
                ).then(function (data) {
                    if (!data.status) {
                        $('#build_attachment').empty();
                        alert(`Validation Error! ${data.message}`)
                    }else{
                                    
                        // `<div class="s_website_form_field mb-3 col-12 s_website_form_custom s_website_form_required" data-type="text" data-name="Field">
                            // $(`#build_attachment`).append(
                            //         `<div class="mb-3">
                            //             <label>${elm.document_file_name}</label>
                            //             <input type="file"
                            //                 class="form-control docuClass"
                            //                 id="fl-${elm.document_file_id}">
                            //         </div>
                            //         `
                            //     )
                        if (data.data.applicant_documentation_checklist_ids.length > 0){
                            $.each(data.data.applicant_documentation_checklist_ids, function(k, elm){
                                $(`#build_attachment`).append(
                                    `<div class="mb-3 col-12">
                                        <div class="row s_col_no_resize s_col_no_bgcolor">
                                            <label class="col-5 col-sm-5" style="min-width: 200px" for="Docu-${elm.document_file_name}">
                                                <span class="s_website_form_label_content" >${elm.document_file_name}</span>
                                            </label>
                                            <div class="col-4 col-sm-4" id="col-sm-docu">
                                                <input type="file" class="form-control docuClass" name="Docuname" id="fl-${elm.document_file_id}" main_id="${elm.document_file_id}" required="${elm.required}"/>
                                            </div>
                                        </div>
                                        <div class="${$.inArray(elm.hr_comment, ['', 'Resubmitted']) !== -1  ? 'd-none': 'alert alert-danger'}" role="alert" style="font-size: 14px;">  
                                            ${elm.hr_comment}<br/>
                                        </div>
                                    </div>
                                    `
                                )
                            })
                            $('.s_website_form_submit').addClass('text-center'); 
                            $('#s_website_form_submit_div').removeClass('d-none')
                            $(`#show-if-no-documentation`).addClass('d-none')
                            console.log("There is data to display")

                        }else{
                            console.log("There is no data to display")
                            $(`#show-if-no-documentation`).removeClass('d-none')
                            $(`#start_documentation_div`).addClass('d-none')
                            $('#s_website_form_submit_div').addClass('d-none')
                        }
                        $('#start_documentation_div').addClass('d-none')
                    }
                })
                // .guardedCatch(function (error) {
                //     let msg = error.message.message
                //     console.log(msg)
                //     $('#build_attachment').empty()
                //     alert(`Unknown Error! ${msg}`)
                // });
 
                 
            },
         },
         

    });