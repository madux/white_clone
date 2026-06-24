/** @odoo-module */

import PublicWidget from "@web/legacy/js/public/public_widget";
import { jsonrpc } from "@web/core/network/rpc_service"; 
 
    // var publicWidget = require('web.public.widget');

    PublicWidget.registry.PortalRecruitmentRequestWidgets = PublicWidget.Widget.extend({
        selector: '#recruitment-form',
        start: function(){
            var self = this;
            return this._super.apply(this, arguments).then(function(){
                 console.log("Abanye gom na recruitment app!!!!")
            });

        },
        willStart: function(){
            var self = this; 
            return this._super.apply(this, arguments).then(function(){
                console.log("Isi mbido recruitment app!!!!")
            })
        },
        events: {
            'blur input, select, textarea': function (ev) {
                let input = $(ev.target)
                if (input.is(":required") && input.val() !== '') {
                    input.removeClass('is-invalid').addClass('is-valid')
                } else if (input.is(":required") && input.val() == '') {
                    input.addClass('is-invalid')
                }
            }, 

        },
    })
    $( document ).ready(function() {
        // $(function(){
        // $("#hr_recruitment_form2")[0].reset();
        $('#level_qualification_header_yes').prop('checked', false);
        $('#reside_job_location_yes').prop('checked', true);
        $('#reside_job_location_no').prop('checked', false);
        console.log("Recruitment form loaded!!!!")
        $('#completed_nysc_no').change(function () {
            if ($(this).prop('checked')) {
                $('#completed_nysc_yes').prop('checked', false);
            }
        });
        $('#completed_nysc_yes').change(function () {
            if ($(this).prop('checked')) {
                $('#completed_nysc_no').prop('checked', false);
            }
        });

        $('#personal_capacity_headings_yes').change(function () {
            if ($(this).prop('checked')) {
                $('#personal_capacity_headings_no').prop('checked', false);
                $('#specify_personal_personality_div_form').removeClass('d-none');
            } 
        });
        $('#personal_capacity_headings_no').change(function () {
            if ($(this).prop('checked')) {
                $('#personal_capacity_headings_yes').prop('checked', false);
                $('#specify_personal_personality_div_form').addClass('d-none');
                $('#specify_personal_personality').val('')
            } 
        });
        $('#level_qualification_header_yes').change(function () {
            if ($(this).prop('checked')) {
                $('#level_qualification_header_no').prop('checked', false);
                $('#level_qualification_header_div_form').removeClass('d-none');

            }
        });
        $('#level_qualification_header_no').change(function () {
            if ($(this).prop('checked')) {
                $('#level_qualification_header_yes').prop('checked', false);
                $('#level_qualification_header_div_form').addClass('d-none');
                $('#specifylevel_qualification').val('')
            }
        });
        $('#reside_job_location_yes').change(function () {
            if ($(this).prop('checked')) {
                $('#reside_job_location_no').prop('checked', false);
                $('#relocation_plans_header_div_form').addClass('d-none');
                $('#relocation_plans_yes').prop('checked', false);
                $('#relocation_plans_no').prop('checked', false);
            }
        });
        $('#reside_job_location_no').change(function () {
            if ($(this).prop('checked')) {
                $('#reside_job_location_yes').prop('checked', false);
                $('#relocation_plans_header_div_form').removeClass('d-none');
            }
        });
        $('#relocation_plans_no').change(function () {
            if ($(this).prop('checked')) {
            $('#relocation_plans_yes').prop('checked', false);
            }
        });
        $('#relocation_plans_yes').change(function () {
            if ($(this).prop('checked')) {
                $('#relocation_plans_no').prop('checked', false);
            }
        });

        $('#resumption_period_yes').change(function () {
            if ($(this).prop('checked')) {
            $('#resumption_period_no').prop('checked', false);
            }
        });
        $('#resumption_period_no').change(function () {
            if ($(this).prop('checked')) {
                $('#resumption_period_yes').prop('checked', false);
            }
        });

        $('#submit_recruitment_form').click(function () {
            // var $input = $('input[type="file"]');
            var $input = $('#Resume');
            var val = $input.val().toLowerCase();
            var regex = new RegExp("(.*?)\.(pdf)$");
            $('.pdf-message').remove();
            if (!(regex.test(val))) {
                $('#o_website_form_result').after('X <span class="pdf-message" style="color:red;">Only pdf files are allowed!</span>');
                alert("Please only PDF files are allowed !!! ")
                return false;
            }
            return true;
        });
        const mediaStream = new MediaStream();
        // navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
        // navigator.mediaDevices.getUserMedia = navigator.mediaDevices.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
        window.URL = window.URL || window.webkitURL;
        var localMediaStream = null;
        var video = document.querySelector('video'); // 
        var canvas = document.querySelector('canvas');

        $("#startCapture").click(function(){
            console.log("starting capture");
            $("#takePhoto").removeClass("d-none");
            // $("#stopCapture").removeClass("d-none");
            $("#startCapture").addClass("d-none");
            $("#passport_img").addClass("d-none");
            $("#video").removeClass("d-none");
            $(this).val("Recapture");
            // navigator.getUserMedia({ video: true }, function (mediaStreams) {
            //     // video.src = window.URL.createObjectURL(stream);
            //     video.srcObject = mediaStreams;
            //     localMediaStream = mediaStreams;
            // }, function (e) {
            //     console.log(e);
            // });
            // navigator.mediaDevices.getUserMedia({ video: true })
            //     .then(function(mediaStreams) {
            //         video.srcObject = mediaStreams;
            //         localMediaStream = mediaStreams;
            //     })
            //     .catch(function (e) {
            //         console.log(e);
            //     });
            // navigator.getUserMedia({ video: true }, function (mediaStreams) {
            //     // video.src = window.URL.createObjectURL(stream);
            //     video.srcObject = mediaStreams;
            //     localMediaStream = mediaStreams;
            // }, function (e) {
            //     console.log(e);
            // });
        });

        var stopCapture = function(){
            console.log("stopping capture");
            video.pause();
            const tracks = video.srcObject.getTracks();

            tracks.forEach((track) => {
                track.stop();
            });
            video.srcObject = null;
            $("#startCapture").removeClass("d-none");
        }

        $("#takePhoto").click(function(){
            console.log("taking capture");
            if (localMediaStream) {
                var ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0, 320, 240);
                var imgsrc = canvas.toDataURL("image/png"); 
                console.log(imgsrc); 
                $("#passport_img").attr('src', imgsrc);
                $("#passport_img").val(imgsrc).trigger('change');
                $("#video").addClass("d-none");
                $("#passport_img").removeClass("d-none");
                $("#stopCapture").addClass("d-none");
                $("#startCapture").removeClass("d-none");
                $(this).addClass("d-none");
                stopCapture();

                // $("#stopCapture").click(function(){
                //     console.log("stopping capture");
                //     video.pause();
                //     const tracks = video.srcObject.getTracks();
        
                //     tracks.forEach((track) => {
                //         track.stop();
                //     });
                //     video.srcObject = null;
                //     $("#startCapture").removeClass("d-none");
                // });
            }
        });

        // $('#submit_recruitment_form').click(function() {
        //     //// submit button
        //     var list_of_fields = [];
        //     $('input,textarea,select').filter('[required]:visible').each(function(ev){
        //         var field = $(this); 
        //         if (field.val() == ""){
        //             field.addClass('is-invalid');
        //             console.log($(this).attr('labelfor'));
        //             list_of_fields.push(field.attr('labelfor'));
        //         }
        //     });
        //     if (list_of_fields.length > 0){
        //         alert(`Validation: Please ensure the following fields are filled.. ${list_of_fields}`)
        //         return false;
        //     }else{
        //         var current_btn = $(ev.target); 
        //         var form = $('#hr_recruitment_form2')[0];
        //         // FormData object 
        //         var formData = new FormData(form);
        //         console.log('recruitment formData is ==>', formData) 
        //         formData.append('productItems', JSON.stringify(productItems))
        //         $.ajax({
        //             type: "POST",
        //             enctype: 'multipart/form-data',
        //             url: "/portal_data_process",
        //             data: formData,
        //             processData: false,
        //             contentType: false,
        //             cache: false,
        //             timeout: 800000,
        //         }).then(function(data) {
        //             console.log(`Recieving response from server => ${JSON.stringify(data)} and ${data} + `)
        //             window.location.href = `/portal-success`;
        //             console.log("XMLREQUEST Successful");
        //             // clearing form content
        //             $("#msform")[0].reset();
        //             $("#tbody_product").empty()
        //         }).catch(function(err) {
        //             console.log(err);
        //             alert(err);
        //         }).then(function() {
        //             console.log(".")
        //         })
        //     }
        // }) 
            
    });
// });
