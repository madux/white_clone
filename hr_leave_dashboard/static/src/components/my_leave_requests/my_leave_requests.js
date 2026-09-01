/** @odoo-module **/
import { Component, onWillStart, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { EmployeeRequestModal } from "../employee_request_modal/employee_request_modal";
import { LeaveRequestDetailModal } from "../leave_request_detail/leave_request_detail";
import { CalendarSidebar } from "../calendar_sidebar";

export class MyLeaveRequestsPage extends Component {
    static template = "hr_leave_dashboard.MyLeaveRequestsPage";
    static components = { EmployeeRequestModal, LeaveRequestDetailModal, CalendarSidebar };
    static props = { embedded: {type: Boolean, optional: true} };
    setup(){this.orm=useService("orm");this.action=useService("action");this.notification=useService("notification");this.state=useState({loading:true,rows:[],counts:{},types:[],status:"all",search:"",typeId:"",requestOpen:false,initial:null,detailId:null,detailReadOnly:true,cancelId:null,cancelReason:"",cancelError:"",escalateId:null,escalationNote:"",escalationError:"",access:{can_approve:false},approvalRows:[],approvalRejectId:null,approvalRejectReason:"",approvalRejectError:""});onWillStart(()=>this.load());}
    async load(){this.state.loading=true;try{const [data,access]=await Promise.all([this.orm.call("hr.leave","get_my_leave_requests",[this.state.status,this.state.search,this.state.typeId||false]),this.orm.call("hr.leave","get_leave_access_profile",[])]);this.state.rows=data.rows||[];this.state.counts=data.counts||{};this.state.types=data.leave_types||[];this.state.access=access;this.state.approvalRows=access.can_approve?(await this.orm.call("hr.leave","get_pending_my_leave_approvals",[])).rows||[]:[];}finally{this.state.loading=false;}}
    async setStatus(status){this.state.status=status;await this.load();}
    onSearchKeydown(ev){if(ev.key==="Enter")this.load();}
    openNew(){this.state.initial=null;this.state.requestOpen=true;} closeNew(){this.state.requestOpen=false;}
    view(id){this.state.detailReadOnly=true;this.state.detailId=id;} viewApproval(id){this.state.detailReadOnly=false;this.state.detailId=id;} closeDetail(){this.state.detailId=null;}
    async approveApproval(id){await this.orm.call("hr.leave","approve_single_request",[id]);this.notification.add("Leave request approved.",{type:"success"});await this.load();}
    openApprovalReject(id){this.state.approvalRejectId=id;this.state.approvalRejectReason="";this.state.approvalRejectError="";}
    closeApprovalReject(){this.state.approvalRejectId=null;}
    async rejectApproval(){const reason=this.state.approvalRejectReason.trim();if(reason.length<3){this.state.approvalRejectError="Provide a reason of at least 3 characters.";return;}await this.orm.call("hr.leave","reject_single_request",[this.state.approvalRejectId,reason]);this.notification.add("Leave request rejected.",{type:"success"});this.closeApprovalReject();await this.load();}
    resubmit(row){this.state.initial={leave_type_id:String(row.leave_type_id),date_from:row.date_from,date_to:row.date_to,reason:row.reason};this.state.requestOpen=true;}
    openCancel(id){this.state.cancelId=id;this.state.cancelReason="";this.state.cancelError="";} closeCancel(){this.state.cancelId=null;}
    async cancel(){const result=await this.orm.call("hr.leave","cancel_my_pending_leave",[this.state.cancelId,this.state.cancelReason]);if(!result.ok){this.state.cancelError=result.message;return;}this.notification.add(result.message,{type:"success"});this.closeCancel();await this.load();}
    openEscalate(id){this.state.escalateId=id;this.state.escalationNote="";this.state.escalationError="";}
    closeEscalate(){this.state.escalateId=null;}
    async escalate(){const result=await this.orm.call("hr.leave","escalate_my_leave_request",[this.state.escalateId,this.state.escalationNote]);if(!result.ok){this.state.escalationError=result.message;return;}this.notification.add(result.message,{type:"success"});this.closeEscalate();await this.load();}
    formatDate(value){return value?new Date(value+"T00:00:00").toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"}):"—";}
    formatSubmitted(value){return value?new Date(value.replace(" ","T")+"Z").toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"}):"—";}
    exportCsv(){const rows=[["Reference","Leave Type","Start","End","Duration","Reason","Status","Approver","Submitted"],...this.state.rows.map(r=>[r.reference,r.leave_type,r.date_from,r.date_to,r.duration,r.reason,r.status,r.approver,r.submitted])];const q=v=>`"${String(v??"").replaceAll('"','""')}"`;const blob=new Blob(["\uFEFF"+rows.map(r=>r.map(q).join(",")).join("\n")],{type:"text/csv"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="my_leave_requests.csv";a.click();URL.revokeObjectURL(a.href);}
    openDashboard(){this.action.doAction("hr_leave_dashboard.action_hr_leave_dashboard");}
    openCalendar(){this.action.doAction("hr_leave_dashboard.action_hr_leave_calendar");}
    openReports(){this.notification.add("Employee leave reports will be available from this menu in the employee reporting screen.",{type:"info"});}
}
registry.category("actions").add("hr_leave_dashboard.MyLeaveRequests",MyLeaveRequestsPage);
