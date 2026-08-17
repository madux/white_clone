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
    setup(){this.orm=useService("orm");this.action=useService("action");this.notification=useService("notification");this.state=useState({loading:true,rows:[],counts:{},types:[],status:"all",search:"",typeId:"",requestOpen:false,initial:null,detailId:null,cancelId:null,cancelReason:"",cancelError:""});onWillStart(()=>this.load());}
    async load(){this.state.loading=true;try{const data=await this.orm.call("hr.leave","get_my_leave_requests",[this.state.status,this.state.search,this.state.typeId||false]);this.state.rows=data.rows||[];this.state.counts=data.counts||{};this.state.types=data.leave_types||[];}finally{this.state.loading=false;}}
    async setStatus(status){this.state.status=status;await this.load();}
    onSearchKeydown(ev){if(ev.key==="Enter")this.load();}
    openNew(){this.state.initial=null;this.state.requestOpen=true;} closeNew(){this.state.requestOpen=false;}
    view(id){this.state.detailId=id;} closeDetail(){this.state.detailId=null;}
    resubmit(row){this.state.initial={leave_type_id:String(row.leave_type_id),date_from:row.date_from,date_to:row.date_to,reason:row.reason};this.state.requestOpen=true;}
    openCancel(id){this.state.cancelId=id;this.state.cancelReason="";this.state.cancelError="";} closeCancel(){this.state.cancelId=null;}
    async cancel(){const result=await this.orm.call("hr.leave","cancel_my_pending_leave",[this.state.cancelId,this.state.cancelReason]);if(!result.ok){this.state.cancelError=result.message;return;}this.notification.add(result.message,{type:"success"});this.closeCancel();await this.load();}
    formatDate(value){return value?new Date(value+"T00:00:00").toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"}):"—";}
    formatSubmitted(value){return value?new Date(value.replace(" ","T")+"Z").toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"}):"—";}
    exportCsv(){const rows=[["Reference","Leave Type","Start","End","Duration","Reason","Status","Approver","Submitted"],...this.state.rows.map(r=>[r.reference,r.leave_type,r.date_from,r.date_to,r.duration,r.reason,r.status,r.approver,r.submitted])];const q=v=>`"${String(v??"").replaceAll('"','""')}"`;const blob=new Blob(["\uFEFF"+rows.map(r=>r.map(q).join(",")).join("\n")],{type:"text/csv"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="my_leave_requests.csv";a.click();URL.revokeObjectURL(a.href);}
    openDashboard(){this.action.doAction("hr_leave_dashboard.action_hr_leave_employee_dashboard");}
    openCalendar(){this.action.doAction("hr_leave_dashboard.action_hr_leave_calendar");}
    openReports(){this.notification.add("Employee leave reports will be available from this menu in the employee reporting screen.",{type:"info"});}
}
registry.category("actions").add("hr_leave_dashboard.MyLeaveRequests",MyLeaveRequestsPage);
