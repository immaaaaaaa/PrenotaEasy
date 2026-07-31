"use client";

import { useMemo } from "react";
import type { Appointment, BusinessHours, Employee, Service } from "@/lib/types";
import { AgendaView } from "@/app/dashboard/AgendaView";
import {
  getOperatorAgendaData,
  getOperatorTodayStats,
  getOperatorMonthAppointments,
  operatorRescheduleAppointment,
  operatorCancelAppointment,
  operatorUpdateOwnerNotes,
  operatorUpdateCustomerNotes,
  operatorGetClients,
  operatorGetClientHistory,
  operatorCreateOwnerAppointment,
} from "../actions";

export function OperatorClientView({
  token,
  business,
  employee,
  employees,
  services,
  todayStr,
  businessHours = [],
  holidays = [],
  initialDayAppts,
}: {
  token: string;
  business: any;
  employee: Employee;
  employees: Employee[];
  services: Service[];
  todayStr: string;
  businessHours?: BusinessHours[];
  holidays?: any[];
  initialDayAppts?: Appointment[];
}) {
  const customActions = useMemo(() => {
    return {
      getDayAppointments: async (date: string) => {
        const res = await getOperatorAgendaData(token, date);
        return res.appointments;
      },
      getTodayStats: async (date: string) => {
        return await getOperatorTodayStats(token, date);
      },
      getMonthAppointments: async (year: number, month: number) => {
        return await getOperatorMonthAppointments(token, year, month);
      },
      rescheduleAppointment: async (arg: any) => {
        return await operatorRescheduleAppointment(token, arg);
      },
      cancelAppointment: async (id: string) => {
        return await operatorCancelAppointment(token, id);
      },
      updateOwnerNotes: async (id: string, notes: string) => {
        return await operatorUpdateOwnerNotes(token, id, notes);
      },
      updateCustomerNotes: async (id: string, notes: string) => {
        return await operatorUpdateCustomerNotes(token, id, notes);
      },
      getClients: async () => {
        return await operatorGetClients(token);
      },
      getClientHistory: async (phone: string) => {
        return await operatorGetClientHistory(token, phone);
      },
      createOwnerAppointment: async (arg: any) => {
        return await operatorCreateOwnerAppointment(token, arg);
      },
    };
  }, [token]);

  return (
    <AgendaView
      business={business}
      timezone={business.timezone}
      employees={employees}
      services={services}
      todayStr={todayStr}
      restrictToEmployeeId={employee.id}
      customActions={customActions}
      businessHours={businessHours}
      holidays={holidays}
      initialDayAppts={initialDayAppts}
    />
  );
}
