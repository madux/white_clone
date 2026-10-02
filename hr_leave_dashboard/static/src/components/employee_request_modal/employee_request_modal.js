/** @odoo-module **/

import { Component, onWillStart, onWillUnmount, useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { SmartDateRecommendationsModal } from "../smart_date_modal/smart_date_modal";

export class EmployeeRequestModal extends Component {
    static template = "hr_leave_dashboard.EmployeeRequestModal";
    static components = { SmartDateRecommendationsModal };
    static props = {
        close: Function,
        submitted: { type: Function, optional: true },
        initial: { type: [Object, { value: null }], optional: true },
        existingRequestId: { type: [Number, { value: null }], optional: true },
    };

    setup() {
        this.orm = useService("orm"); this.notification = useService("notification"); this.action = useService("action");
        this.state = useState({
            loading: true,
            submitting: false,
            step: 1,
            types: [],
            balances: [],
            backupColleagues: [],
            nlEnabled: false,
            dateRecEnabled: false,
            nlText: "",
            nlLoading: false,
            nlError: "",
            nlSummary: "",
            showNlSummary: false,
            aiAssistedFields: [],
            showDateRecModal: false,
            entryMode: "form",
            voiceSupported: false,
            listening: false,
            voiceProcessing: false,
            aiDetailsAccepted: false,
            submittedResult: null,
            form: {
                leave_type_id: false,
                date_from: "",
                date_to: "",
                half_day: false,
                period: "am",
                reason: "",
                blackout_exception_requested: false,
                handover_enabled: false,
                backup_colleague_ids: [],
                emergency_contact: "",
                handover_notes: "",
                attachment: null,
                submission_channel: "form",
            },
            preview: null,
            error: "",
        });
        this.state.voiceSupported = Boolean(
            (navigator.mediaDevices?.getUserMedia && window.MediaRecorder)
            || window.SpeechRecognition
            || window.webkitSpeechRecognition
        );
        this.voiceShouldListen = false;
        this.voiceBaseText = "";
        this.voiceCommittedText = "";
        this.voiceInterimText = "";
        this.voiceRestartTimer = null;
        this.voiceRecordingTimer = null;
        this.voiceDiscardRecording = false;
        onWillUnmount(() => {
            this.voiceShouldListen = false;
            if (this.voiceRestartTimer) clearTimeout(this.voiceRestartTimer);
            if (this.voiceRecordingTimer) clearTimeout(this.voiceRecordingTimer);
            if (this.voiceRecognition) this.voiceRecognition.abort();
            if (this.mediaRecorder?.state === "recording") {
                this.voiceDiscardRecording = true;
                this.mediaRecorder.onstop = null;
                this.mediaRecorder.stop();
            }
            if (this.voiceMediaStream) this.voiceMediaStream.getTracks().forEach((track) => track.stop());
        });
        onWillStart(async () => {
            const data = await this.orm.call("hr.leave", "get_employee_request_options", []);
            this.state.types = data.leave_types || [];
            this.state.balances = data.leave_types || [];
            this.state.backupColleagues = data.backup_colleagues || [];
            this.state.nlEnabled = Boolean(data.ai_capabilities?.nl_request);
            this.state.dateRecEnabled = Boolean(data.ai_capabilities?.date_recommendations);
            if (this.props.initial) Object.assign(this.state.form, this.props.initial);
            this.state.loading = false;
            if (this.props.initial) await this.preview();
        });
    }
    get selectedType() { return this.state.types.find(item => item.id === Number(this.state.form.leave_type_id)); }
    get detailsValid() { const p = this.state.preview; return p && p.eligible && !(p.errors || []).length && this.state.form.reason.trim().length >= 5; }
    get handoverValid() { return (!this.state.form.handover_enabled || this.state.form.backup_colleague_ids.length > 0) && (!this.state.preview?.document_required || Boolean(this.state.form.attachment)); }
    get canSubmit() { return !this.state.submitting && this.detailsValid && this.handoverValid; }
    get selectedBackups() { return this.state.backupColleagues.filter(item => this.state.form.backup_colleague_ids.includes(item.id)); }
    get today() {
        const date = new Date();
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    }
    friendlyError(error, fallback) {
        const message = error?.data?.message || error?.cause?.data?.message || error?.cause?.message;
        if (message && !/odoo server error/i.test(message)) return message;
        return fallback;
    }
    onStartChange() { if (!this.state.form.date_to || this.state.form.date_to < this.state.form.date_from) this.state.form.date_to = this.state.form.date_from; return this.preview(); }
    onTypeChange() { if (this.selectedType && !this.selectedType.allow_half_day) this.state.form.half_day = false; return this.preview(); }
    async preview() {
        const f = this.state.form; this.state.error = "";
        if (!f.leave_type_id || !f.date_from || !f.date_to) { this.state.preview = null; return; }
        try { this.state.preview = await this.orm.call("hr.leave", "preview_employee_leave_request", [Number(f.leave_type_id), f.date_from, f.date_to, f.half_day, f.period]); }
        catch (error) { this.state.preview = null; this.state.error = this.friendlyError(error, "We could not validate these dates. Please review them and try again."); }
    }
    async onFileChange(event) {
        const file = event.target.files?.[0]; if (!file) { this.state.form.attachment = null; return; }
        if (!["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/jpeg", "image/png"].includes(file.type)) { this.state.error = "Only PDF, DOC, DOCX, JPG and PNG files are supported."; event.target.value = ""; return; }
        if (file.size > 10 * 1024 * 1024) { this.state.error = "The attachment must not exceed 10 MB."; event.target.value = ""; return; }
        const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1]); reader.onerror = reject; reader.readAsDataURL(file); });
        this.state.form.attachment = { name: file.name, mimetype: file.type, data }; this.state.error = "";
    }
    removeFile() { this.state.form.attachment = null; }
    toggleBackup(id) { const selected = this.state.form.backup_colleague_ids; this.state.form.backup_colleague_ids = selected.includes(id) ? selected.filter(item => item !== id) : [...selected, id]; }
    next() { if (this.state.step === 1 && !this.detailsValid) return; if (this.state.step === 2 && !this.handoverValid) return; this.state.step = Math.min(3, this.state.step + 1); }
    back() {
        if (this.state.entryMode === "ai" && this.state.step === 3) {
            this.state.aiDetailsAccepted = false;
            this.state.step = 1;
            return;
        }
        this.state.step = Math.max(1, this.state.step - 1);
    }
    async parseNlRequest() {
        if (!this.state.nlText.trim() || this.state.nlLoading) return;
        this.state.nlLoading = true;
        this.state.nlError = "";
        try {
            const res = await this.orm.call("hr.leave.ai.service", "parse_nl_leave_request", [this.state.nlText]);
            if (!res.ok) {
                this.state.nlError = res.error || "Failed to process text.";
                return;
            }
            if (res.clarification_needed) {
                this.state.nlError = res.clarification_needed;
            }
            if (res.leave_type_id) {
                const suggestedId = Number(res.leave_type_id);
                const available = this.state.types.find((item) => Number(item.id) === suggestedId);
                if (available) this.state.form.leave_type_id = Number(available.id);
            }
            // Name fallback keeps the form usable if a provider returned a
            // valid Odoo type name but serialized the ID unexpectedly.
            if (!this.state.form.leave_type_id && res.leave_type_name) {
                const normalized = String(res.leave_type_name).trim().toLowerCase();
                const available = this.state.types.find((item) => String(item.name).trim().toLowerCase() === normalized);
                if (available) this.state.form.leave_type_id = Number(available.id);
            }
            if (res.date_from) {
                this.state.form.date_from = res.date_from;
            }
            if (res.date_to) {
                this.state.form.date_to = res.date_to;
            }
            if (res.half_day) {
                this.state.form.half_day = true;
                this.state.form.period = res.period || "am";
            }
            if (res.reason) {
                this.state.form.reason = res.reason;
            }
            this.state.aiAssistedFields = res.suggested_fields || [];
            this.state.nlSummary = res.summary || "";
            this.state.showNlSummary = Boolean(
                res.summary || res.leave_type_id || res.leave_type_name || res.date_from || res.date_to
            );
            this.state.form.submission_channel = "ai_assisted";
            this.state.aiDetailsAccepted = false;
            await this.preview();
        } catch (error) {
            this.state.nlError = this.friendlyError(error, "Could not process request via AI. Please fill in details manually.");
        } finally {
            this.state.nlLoading = false;
        }
    }

    clearNl() {
        this.state.nlText = "";
        this.state.nlSummary = "";
        this.state.showNlSummary = false;
        this.state.nlError = "";
        this.state.aiAssistedFields = [];
        this.state.form.submission_channel = "form";
        this.state.aiDetailsAccepted = false;
    }

    setEntryMode(mode) {
        this.state.entryMode = mode;
        if (mode === "form") this.state.aiDetailsAccepted = false;
        if (mode !== "ai") this.stopVoice();
    }

    useAiDetails() {
        this.state.aiDetailsAccepted = true;
        // The AI path is intentionally compact: suggestion -> review -> success.
        // Manual requests keep the full handover/documents wizard step.
        this.state.step = 3;
        this.stopVoice();
    }

    async viewMyRequests() {
        await this.notifySubmitted();
        this.props.close();
        await this.action.doAction("hr_leave_dashboard.action_hr_leave_my_requests");
    }

    async closeSuccess() {
        await this.notifySubmitted();
        this.props.close();
    }

    async closeModal() {
        if (this.state.submittedResult) await this.notifySubmitted();
        this.props.close();
    }

    async notifySubmitted() {
        if (this.submissionNotified || !this.props.submitted) return;
        this.submissionNotified = true;
        await this.props.submitted();
    }

    async toggleVoice() {
        if (this.voiceShouldListen) return this.stopVoice();
        if (this.state.voiceProcessing) return;
        if (!window.isSecureContext && !navigator.mediaDevices?.getUserMedia) {
            this.state.nlError = "Microphone recording is blocked on this address. Open Odoo through HTTPS, localhost, or 127.0.0.1.";
            return;
        }
        if (navigator.mediaDevices?.getUserMedia && window.MediaRecorder) {
            await this.startMediaRecording();
            return;
        }
        const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!Recognition) {
            this.state.nlError = window.isSecureContext
                ? "Voice input is not supported by this browser. You can still type your request."
                : "Microphone access requires HTTPS, except when Odoo is opened through localhost or 127.0.0.1.";
            return;
        }
        this.voiceShouldListen = true;
        this.voiceBaseText = this.state.nlText.trim();
        this.voiceCommittedText = "";
        this.voiceInterimText = "";
        this.state.nlError = "";
        this.startVoiceRecognition();
    }

    async startMediaRecording() {
        this.state.nlError = "";
        this.voiceDiscardRecording = false;
        try {
            this.voiceMediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
            const mimeType = candidates.find((item) => window.MediaRecorder.isTypeSupported?.(item));
            this.voiceChunks = [];
            this.mediaRecorder = new MediaRecorder(this.voiceMediaStream, mimeType ? { mimeType } : undefined);
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data?.size) this.voiceChunks.push(event.data);
            };
            this.mediaRecorder.onerror = () => {
                this.voiceDiscardRecording = true;
                this.state.nlError = "The browser could not record from the microphone. Check the selected input device.";
                this.stopVoice();
            };
            this.mediaRecorder.onstop = async () => {
                if (this.voiceRecordingTimer) clearTimeout(this.voiceRecordingTimer);
                this.voiceRecordingTimer = null;
                const recorder = this.mediaRecorder;
                const chunks = this.voiceChunks || [];
                const discard = this.voiceDiscardRecording;
                this.mediaRecorder = null;
                this.voiceChunks = [];
                this.state.listening = false;
                this.voiceShouldListen = false;
                if (this.voiceMediaStream) this.voiceMediaStream.getTracks().forEach((track) => track.stop());
                this.voiceMediaStream = null;
                if (!discard && chunks.length) {
                    const blob = new Blob(chunks, { type: recorder?.mimeType || "audio/webm" });
                    await this.transcribeVoiceBlob(blob);
                }
            };
            this.voiceShouldListen = true;
            this.state.listening = true;
            this.mediaRecorder.start(500);
            this.voiceRecordingTimer = setTimeout(() => this.stopVoice(), 60000);
        } catch (error) {
            this.voiceShouldListen = false;
            this.state.listening = false;
            if (this.voiceMediaStream) this.voiceMediaStream.getTracks().forEach((track) => track.stop());
            this.voiceMediaStream = null;
            const denied = error?.name === "NotAllowedError" || error?.name === "SecurityError";
            this.state.nlError = denied
                ? "Microphone permission was denied. Allow microphone access for this site and try again."
                : "The microphone could not be opened. Check the selected input device and browser permissions.";
        }
    }

    async transcribeVoiceBlob(blob) {
        if (!blob.size) return;
        if (blob.size > 10 * 1024 * 1024) {
            this.state.nlError = "The voice recording is too large. Please keep it under one minute.";
            return;
        }
        this.state.voiceProcessing = true;
        this.state.nlError = "";
        try {
            const audioData = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
            const result = await this.orm.call(
                "hr.leave.ai.service",
                "transcribe_leave_request_audio",
                [audioData, blob.type || "audio/webm"]
            );
            if (!result?.ok || !result.text?.trim()) {
                this.state.nlError = result?.error || "No speech could be transcribed from the recording.";
                return;
            }
            this.state.nlText = [this.state.nlText.trim(), result.text.trim()].filter(Boolean).join(" ");
        } catch (error) {
            this.state.nlError = this.friendlyError(error, "The recording could not be transcribed. Please try again or type the request.");
        } finally {
            this.state.voiceProcessing = false;
        }
    }

    startVoiceRecognition() {
        if (!this.voiceShouldListen || this.voiceRecognition) return;
        const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.voiceRecognition = new Recognition();
        this.voiceRecognition.lang = (document.documentElement.lang || "en-US").replace("_", "-");
        this.voiceRecognition.interimResults = true;
        this.voiceRecognition.continuous = true;
        this.voiceRecognition.onstart = () => { this.state.listening = true; };
        this.voiceRecognition.onresult = (event) => {
            let interimText = "";
            for (let index = event.resultIndex; index < event.results.length; index++) {
                const text = event.results[index][0]?.transcript || "";
                if (event.results[index].isFinal) this.voiceCommittedText = `${this.voiceCommittedText} ${text}`.trim();
                else interimText = `${interimText} ${text}`.trim();
            }
            this.voiceInterimText = interimText;
            this.state.nlText = [this.voiceBaseText, this.voiceCommittedText, this.voiceInterimText].filter(Boolean).join(" ");
        };
        this.voiceRecognition.onerror = (event) => {
            const code = event.error || "unknown";
            if (code === "no-speech" || code === "aborted") return;
            this.voiceShouldListen = false;
            this.state.listening = false;
            const errors = {
                "not-allowed": "Microphone permission was denied. Allow microphone access for this site and try again.",
                "service-not-allowed": "Browser speech recognition is blocked for this site.",
                "audio-capture": "No working microphone was found. Check the selected input device and try again.",
                network: "The browser speech-recognition service is unavailable. Check your connection or type the request.",
            };
            this.state.nlError = errors[code] || `Voice input stopped (${code}). Please try again or type your request.`;
        };
        this.voiceRecognition.onend = () => {
            this.voiceRecognition = null;
            if (this.voiceInterimText) {
                this.voiceCommittedText = `${this.voiceCommittedText} ${this.voiceInterimText}`.trim();
                this.voiceInterimText = "";
                this.state.nlText = [this.voiceBaseText, this.voiceCommittedText].filter(Boolean).join(" ");
            }
            if (this.voiceShouldListen) {
                this.voiceRestartTimer = setTimeout(() => {
                    this.voiceRestartTimer = null;
                    this.startVoiceRecognition();
                }, 250);
            } else {
                this.state.listening = false;
            }
        };
        try {
            this.voiceRecognition.start();
        } catch (error) {
            this.voiceRecognition = null;
            this.voiceShouldListen = false;
            this.state.listening = false;
            this.state.nlError = "The microphone could not be started. Check browser permission and try again.";
        }
    }

    stopVoice() {
        this.voiceShouldListen = false;
        if (this.voiceRecordingTimer) {
            clearTimeout(this.voiceRecordingTimer);
            this.voiceRecordingTimer = null;
        }
        if (this.mediaRecorder?.state === "recording") {
            this.mediaRecorder.stop();
            return;
        }
        if (this.voiceRestartTimer) {
            clearTimeout(this.voiceRestartTimer);
            this.voiceRestartTimer = null;
        }
        if (this.voiceRecognition) this.voiceRecognition.stop();
        this.state.listening = false;
    }

    openDateRecModal() {
        this.state.showDateRecModal = true;
    }

    closeDateRecModal() {
        this.state.showDateRecModal = false;
    }

    async onSelectRecommendedDate(item) {
        if (!item) return;
        this.state.form.date_from = item.date_from;
        this.state.form.date_to = item.date_to;
        if (item.leave_type_id) {
            this.state.form.leave_type_id = Number(item.leave_type_id);
        }
        this.state.aiAssistedFields = [...new Set([...this.state.aiAssistedFields, "date_from", "date_to"])];
        this.state.form.submission_channel = "ai_assisted";
        this.state.showDateRecModal = false;
        await this.preview();
    }

    async submit() {
        if (!this.canSubmit) return; this.state.submitting = true;
        try {
            const values = {
                ...this.state.form,
                leave_type_id: Number(this.state.form.leave_type_id),
                submission_channel: this.state.aiAssistedFields.length > 0 ? "ai_assisted" : (this.state.form.submission_channel || "form"),
            };
            const existingRequestId = this.props.existingRequestId || this.props.initial?._existing_request_id;
            const result = existingRequestId ? await this.orm.call("hr.leave", "resubmit_employee_leave_request", [existingRequestId, values]) : await this.orm.call("hr.leave", "submit_employee_leave_request", [values]);
            if (!result.ok) { this.state.error = result.message || "Please review the request details and try again."; return; }
            this.notification.add(result.message, { title: result.reference, type: "success" });
            this.state.submittedResult = result;
            this.state.step = 4;
        }
        catch (error) { this.state.error = this.friendlyError(error, "We could not submit your request right now. Please try again or contact HR if the problem continues."); }
        finally { this.state.submitting = false; }
    }
}
