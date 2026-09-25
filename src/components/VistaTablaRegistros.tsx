import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Download,
  Calendar,
  X,
  Play,
  ExternalLink,
  PhoneCall,
  Smartphone,
  MessageSquare,
  Zap,
  Users,
  Edit,
  Plus,
  Check,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { ColumnFilterDropdown } from './ColumnFilterDropdown';
import { DateRangeFilter } from './DateRangeFilter';
import { getRangoSemanaActual, getRangoDefaultLeads } from '../utils/dateHelpers';

export interface ColumnaDef {
  clave: string;
  etiqueta: string;
  grupo?: string;
  esFecha?: boolean;
  render?: (val: any, fila: any) => React.ReactNode;
}

interface VistaTablaRegistrosProps {
  titulo: string;
  subtitulo: string;
  icono: 'pbx' | 'celular' | 'whatsapp' | 'leads' | 'teams';
  datos: any[];
  columnas: ColumnaDef[];
  catalogo?: any[];
  onGuardarTeams?: (reunion: any) => Promise<boolean>;
}

export const VistaTablaRegistros: React.FC<VistaTablaRegistrosProps> = ({
  titulo,
  subtitulo,
  icono,
  datos,
  columnas,
  catalogo = [],
  onGuardarTeams,
}) => {
  const [busqueda, setBusqueda] = useState('');
  const rangoInicial = getRangoDefaultLeads();
  const [fechaInicio, setFechaInicio] = useState(rangoInicial.inicio);
  const [fechaFin, setFechaFin] = useState(rangoInicial.fin);

  // Estado para modal de Teams (Ingresar/Editar llamada)
  const [modalTeamsAbierto, setModalTeamsAbierto] = useState(false);
  const [editingTeamsItem, setEditingTeamsItem] = useState<any | null>(null);
  const [guardandoTeams, setGuardandoTeams] = useState(false);

  // Filtros dinámicos por cada columna: { [claveColumna]: string[] (valores marcados) }
  const [filtrosColumnas, setFiltrosColumnas] = useState<Record<string, string[]>>({});

  // Para leads calificados: mostrar por defecto solo los que tienen reunión agendada pactada
  const [soloConReunion, setSoloConReunion] = useState(icono === 'leads');

  const handleCambiarFiltroColumna = (clave: string, seleccionados: string[]) => {
    setFiltrosColumnas((prev) => ({
      ...prev,
      [clave]: seleccionados,
    }));
  };

  const abrirModalTeamsNuevo = () => {
    setEditingTeamsItem({
      codigo_prospecto: '',
      cliente: '',
      ejecutivo: catalogo[0]?.nombre_ejecutivo || '',
      pais: 'SV',
      fecha_reunion: new Date().toISOString().slice(0, 10),
      hora_reunion: '10:00',
      estado_teams: 'Si se hizo y tiene evidencia',
      evidencia_url: '',
      notas: '',
    });
    setModalTeamsAbierto(true);
  };

  const abrirModalTeamsEditar = (fila: any) => {
    setEditingTeamsItem({
      id: fila.id,
      codigo_prospecto: fila.codigo_prospecto || '',
      cliente: fila.cliente || fila.nombre_prospecto || '',
      ejecutivo: fila.ejecutivo_nombre || fila.ejecutivo || '',
      pais: fila.pais || 'SV',
      fecha_reunion: fila.fecha_reunion || (fila.fecha_agendada ? String(fila.fecha_agendada).slice(0, 10) : new Date().toISOString().slice(0, 10)),
      hora_reunion: fila.hora_reunion || (fila.hora_agendada ? String(fila.hora_agendada).slice(0, 5) : '10:00'),
      estado_teams: fila.estado_teams || 'Si se hizo y tiene evidencia',
      evidencia_url: fila.evidencia_url || '',
      notas: fila.notas || '',
    });
    setModalTeamsAbierto(true);
  };

  const handleGuardarTeamsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeamsItem || !onGuardarTeams) return;
    setGuardandoTeams(true);
    try {
      const ok = await onGuardarTeams(editingTeamsItem);
      if (ok) {
        setModalTeamsAbierto(false);
        setEditingTeamsItem(null);
      }
    } finally {
      setGuardandoTeams(false);
    }
  };

  const renderIcono = () => {
    switch (icono) {
      case 'pbx':
        return <PhoneCall className="h-5 w-5 text-red-400" />;
      case 'celular':
        return <Smartphone className="h-5 w-5 text-blue-400" />;
      case 'whatsapp':
        return <MessageSquare className="h-5 w-5 text-emerald-400" />;
      case 'leads':
        return <Zap className="h-5 w-5 text-amber-400" />;
      case 'teams':
        return <Users className="h-5 w-5 text-purple-400" />;
    }
  };

  // 1. Filtrado por fechas robusto y filtro de solo reuniones agendadas
  const datosConFecha = useMemo(() => {
    let base = datos;

    // Si es leads y está marcado soloConReunion, filtrar solo los que tienen fecha_agendada real
    if (icono === 'leads' && soloConReunion) {
      base = base.filter(
        (fila) =>
          fila.fecha_agendada &&
          String(fila.fecha_agendada).trim() !== '' &&
          fila.fecha_agendada !== 'null'
      );
    }

    if (!fechaInicio && !fechaFin) return base;

    // Detectar columna de fecha en la tabla
    const colFecha = columnas.find((c) =>
      c.esFecha ||
      c.clave.includes('fecha') ||
      c.clave.includes('created_at') ||
      c.clave.includes('hora')
    )?.clave;

    return base.filter((fila) => {
      let valor = colFecha ? fila[colFecha] : null;
      if (!valor) {
        valor =
          fila.fecha_agendada ||
          fila.fecha_creado ||
          (fila.created_at ? String(fila.created_at).slice(0, 10) : null) ||
          fila.fecha;
      }
      if (!valor) return true;
      const strFecha = String(valor).slice(0, 10);
      if (fechaInicio && strFecha < fechaInicio) return false;
      if (fechaFin && strFecha > fechaFin) return false;
      return true;
    });
  }, [datos, fechaInicio, fechaFin, columnas, icono, soloConReunion]);

  // 2. Extraer valores únicos por cada columna para el checklist
  const valoresUnicosPorColumna = useMemo(() => {
    const mapa: Record<string, string[]> = {};
    columnas.forEach((col) => {
      const setVal = new Set<string>();
      datosConFecha.forEach((fila) => {
        let val = fila[col.clave];
        if (typeof val === 'boolean') {
          val = val ? 'Sí' : 'No';
        }
        if (val !== undefined && val !== null) {
          setVal.add(String(val).trim());
        }
      });
      mapa[col.clave] = Array.from(setVal).slice(0, 200).sort(); // Limitar a 200 valores representativos
    });
    return mapa;
  }, [datosConFecha, columnas]);

  // 3. Filtrado completo por buscador global y checklist de columnas
  const filtrados = useMemo(() => {
    let resultado = datosConFecha;

    // A. Buscador global
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase().trim();
      resultado = resultado.filter((fila) =>
        Object.values(fila).some(
          (val) => val !== null && val !== undefined && String(val).toLowerCase().includes(q)
        )
      );
    }

    // B. Filtros individuales por cada columna
    Object.entries(filtrosColumnas).forEach(([clave, seleccionados]) => {
      if (seleccionados.length === 0) return; // todos permitidos
      if (seleccionados.includes('__NINGUNO__')) {
        resultado = [];
        return;
      }

      resultado = resultado.filter((fila) => {
        let valorFila = fila[clave];
        if (typeof valorFila === 'boolean') {
          valorFila = valorFila ? 'Sí' : 'No';
        }
        const strValor = String(valorFila ?? '').trim();
        return seleccionados.includes(strValor);
      });
    });

    return resultado;
  }, [datosConFecha, busqueda, filtrosColumnas]);

  // Agrupamiento de columnas (ej: KPI RETROALIMENTACION / KPI SLA)
  const hayGrupos = useMemo(() => columnas.some((c) => Boolean(c.grupo)), [columnas]);

  const headerEstructura = useMemo(() => {
    if (!hayGrupos) return { row1: [], row2: [] };

    type ItemRow1 =
      | { type: 'single'; col: ColumnaDef; index: number }
      | { type: 'group'; grupo: string; colSpan: number; index: number };

    const row1: ItemRow1[] = [];
    let i = 0;
    while (i < columnas.length) {
      const col = columnas[i];
      if (!col.grupo) {
        row1.push({ type: 'single', col, index: i });
        i++;
      } else {
        const grupoName = col.grupo;
        let span = 0;
        const startIdx = i;
        while (i < columnas.length && columnas[i].grupo === grupoName) {
          span++;
          i++;
        }
        row1.push({ type: 'group', grupo: grupoName, colSpan: span, index: startIdx });
      }
    }

    const row2 = columnas.filter((c) => Boolean(c.grupo));

    return { row1, row2 };
  }, [columnas, hayGrupos]);

  const filtrosActivosTotal =
    Object.values(filtrosColumnas).filter((s) => s.length > 0).length +
    (fechaInicio || fechaFin ? 1 : 0);

  const handleLimpiarTodosFiltros = () => {
    setBusqueda('');
    setFechaInicio('');
    setFechaFin('');
    setFiltrosColumnas({});
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700/60">
              {renderIcono()}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-wide">{titulo}</h2>
              <p className="text-xs text-slate-400 mt-0.5">{subtitulo}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {icono === 'leads' && (
              <button
                type="button"
                onClick={() => setSoloConReunion(!soloConReunion)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                  soloConReunion
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500 shadow-sm'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
                title="Alternar entre ver solo prospectos con fecha de reunión agendada o todos los calificados"
              >
                <Check className={`h-3.5 w-3.5 ${soloConReunion ? 'text-emerald-400' : 'text-slate-500'}`} />
                <span>{soloConReunion ? 'Solo Con Reunión Agendada (Activo)' : 'Ver Todos los Calificados'}</span>
              </button>
            )}
            {icono === 'teams' && (
              <button
                type="button"
                onClick={abrirModalTeamsNuevo}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs shadow-sm transition-all cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Registrar Reunión Teams</span>
              </button>
            )}
            <div className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300">
              {filtrados.length} / {datos.length} registros
            </div>
            {filtrosActivosTotal > 0 && (
              <button
                type="button"
                onClick={handleLimpiarTodosFiltros}
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 hover:bg-rose-900"
              >
                <X className="h-3 w-3" /> Limpiar ({filtrosActivosTotal})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Controles de Filtros: Rango de Fechas & Buscador Dinámico */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Filtro de Rango de Fechas */}
        <DateRangeFilter
          fechaInicio={fechaInicio}
          fechaFin={fechaFin}
          onChangeInicio={setFechaInicio}
          onChangeFin={setFechaFin}
          onLimpiar={() => {
            setFechaInicio('');
            setFechaFin('');
          }}
          label="Filtrar Fecha"
        />

        {/* Buscador General */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar en todos los campos..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
          />
        </div>
      </div>

      {/* Aviso contextual de rango de fecha activo */}
      {(fechaInicio || fechaFin) && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-300">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
            Filtro de fecha activo: <strong className="text-white font-mono">{fechaInicio || 'Inicio'}</strong> al <strong className="text-white font-mono">{fechaFin || 'Fin'}</strong> ({filtrados.length} de {datos.length} registros).
          </span>
          <button
            type="button"
            onClick={() => {
              setFechaInicio('');
              setFechaFin('');
            }}
            className="text-xs font-semibold text-rose-400 hover:text-rose-300 underline cursor-pointer"
          >
            Quitar filtro y ver todos ({datos.length})
          </button>
        </div>
      )}

      {/* Tabla de Datos con Filtros en Cada Columna */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto max-h-[650px]">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase font-bold sticky top-0 z-20 border-b border-slate-800">
              {hayGrupos ? (
                <>
                  {/* Fila 1: Grupos superiores y columnas sin grupo con rowSpan=2 */}
                  <tr className="border-b border-slate-800/80">
                    {headerEstructura.row1.map((item) => {
                      if (item.type === 'group') {
                        const esRetro = item.grupo.includes('RETROALIMENTACION');
                        return (
                          <th
                            key={item.grupo + item.index}
                            colSpan={item.colSpan}
                            className={`py-2 px-3 text-center text-[11px] font-extrabold tracking-wider uppercase border-l border-r border-slate-800 ${
                              esRetro
                                ? 'bg-amber-950/40 text-amber-300 border-amber-800/50'
                                : 'bg-blue-950/40 text-blue-300 border-blue-800/50'
                            }`}
                          >
                            {item.grupo}
                          </th>
                        );
                      }
                      const col = item.col;
                      const idx = item.index;
                      return (
                        <th
                          key={col.clave}
                          rowSpan={2}
                          className="py-3 px-4 whitespace-nowrap align-bottom border-b border-slate-800 bg-slate-950"
                        >
                          <ColumnFilterDropdown
                            titulo={col.etiqueta}
                            clave={col.clave}
                            valoresUnicos={valoresUnicosPorColumna[col.clave] || []}
                            seleccionados={filtrosColumnas[col.clave] || []}
                            onCambiarSeleccion={handleCambiarFiltroColumna}
                            alineacion={idx > columnas.length - 3 ? 'right' : 'left'}
                          />
                        </th>
                      );
                    })}
                  </tr>
                  {/* Fila 2: Sub-columnas correspondientes a los grupos */}
                  <tr>
                    {headerEstructura.row2.map((col, idx) => (
                      <th
                        key={col.clave}
                        className="py-2 px-3 whitespace-nowrap text-center border-b border-slate-800 bg-slate-900/60"
                      >
                        <ColumnFilterDropdown
                          titulo={col.etiqueta}
                          clave={col.clave}
                          valoresUnicos={valoresUnicosPorColumna[col.clave] || []}
                          seleccionados={filtrosColumnas[col.clave] || []}
                          onCambiarSeleccion={handleCambiarFiltroColumna}
                          alineacion="left"
                        />
                      </th>
                    ))}
                  </tr>
                </>
              ) : (
                <tr>
                  {columnas.map((col, idx) => (
                    <th key={col.clave} className="py-3 px-4 whitespace-nowrap">
                      <ColumnFilterDropdown
                        titulo={col.etiqueta}
                        clave={col.clave}
                        valoresUnicos={valoresUnicosPorColumna[col.clave] || []}
                        seleccionados={filtrosColumnas[col.clave] || []}
                        onCambiarSeleccion={handleCambiarFiltroColumna}
                        alineacion={idx > columnas.length - 3 ? 'right' : 'left'}
                      />
                    </th>
                  ))}
                  {icono === 'teams' && (
                    <th className="py-3 px-4 text-right whitespace-nowrap uppercase text-[11px] font-bold text-slate-400">
                      Acciones
                    </th>
                  )}
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-slate-800/80 font-mono">
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={columnas.length + (icono === 'teams' ? 1 : 0)} className="py-12 px-6 text-center">
                    <div className="max-w-md mx-auto space-y-3 font-sans">
                      <div className="inline-flex p-3 rounded-full bg-slate-800/80 border border-slate-700 text-slate-400 mb-1">
                        <AlertCircle className="h-6 w-6 text-amber-400" />
                      </div>
                      <p className="text-sm font-semibold text-white">
                        No se encontraron registros en el rango seleccionado {fechaInicio && fechaFin ? `(${fechaInicio} al ${fechaFin})` : ''}
                      </p>
                      <p className="text-xs text-slate-400">
                        En la base de datos de Leads, los registros agendados disponibles llegan hasta el 16 de septiembre. Puedes alternar rápidamente con los siguientes accesos directos:
                      </p>
                      <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setFechaInicio('2026-09-14');
                            setFechaFin('2026-09-20');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-amber-950/80 border border-amber-700/80 text-amber-300 hover:bg-amber-900 text-xs font-medium cursor-pointer transition-colors"
                        >
                          Semana con Leads (14-20 Sep)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFechaInicio('2026-09-01');
                            setFechaFin('2026-09-30');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-indigo-950/80 border border-indigo-700/80 text-indigo-300 hover:bg-indigo-900 text-xs font-medium cursor-pointer transition-colors"
                        >
                          Todo Septiembre (01-30 Sep)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFechaInicio('');
                            setFechaFin('');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 text-xs font-medium cursor-pointer transition-colors"
                        >
                          Ver Todos
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filtrados.map((fila, i) => (
                  <tr key={fila.id || fila.uniqueid || i} className="hover:bg-slate-800/50 transition-colors">
                    {columnas.map((col) => (
                      <td key={col.clave} className="py-2.5 px-4 whitespace-nowrap">
                        {col.render
                          ? col.render(fila[col.clave], fila)
                          : fila[col.clave] !== undefined && fila[col.clave] !== null
                          ? String(fila[col.clave])
                          : <span className="text-slate-600 font-sans">-</span>}
                      </td>
                    ))}
                    {icono === 'teams' && (
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => abrirModalTeamsEditar(fila)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-purple-950/80 border border-purple-700/80 text-purple-300 hover:bg-purple-900 text-xs font-sans font-medium transition-colors cursor-pointer"
                        >
                          <Edit className="h-3 w-3" />
                          <span>{fila.evidencia_url ? 'Editar' : 'Ingresar Datos'}</span>
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal para Ingresar / Editar Datos de Reunión Teams */}
      {modalTeamsAbierto && editingTeamsItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-purple-950/80 border border-purple-700/80 text-purple-400">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {editingTeamsItem.id ? 'Editar Datos de Reunión Teams' : 'Registrar Nueva Reunión Teams'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Evidencia y resultado para el cruce de leads virtuales
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalTeamsAbierto(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleGuardarTeamsSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Código Lead / Prospecto</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: LD651"
                    value={editingTeamsItem.codigo_prospecto}
                    onChange={(e) => setEditingTeamsItem({ ...editingTeamsItem, codigo_prospecto: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">País</label>
                  <select
                    value={editingTeamsItem.pais || 'SV'}
                    onChange={(e) => setEditingTeamsItem({ ...editingTeamsItem, pais: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="SV">🇸🇻 El Salvador (SV)</option>
                    <option value="GT">🇬🇹 Guatemala (GT)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Nombre del Cliente / Prospecto</label>
                <input
                  type="text"
                  placeholder="Nombre completo del cliente"
                  value={editingTeamsItem.cliente}
                  onChange={(e) => setEditingTeamsItem({ ...editingTeamsItem, cliente: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Ejecutivo Asignado (Catálogo)</label>
                <select
                  value={editingTeamsItem.ejecutivo}
                  onChange={(e) => setEditingTeamsItem({ ...editingTeamsItem, ejecutivo: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                >
                  {catalogo.length > 0 ? (
                    catalogo.map((cat: any) => (
                      <option key={cat.id || cat.usuario} value={cat.nombre_ejecutivo}>
                        {cat.nombre_ejecutivo} ({cat.pais === 'GT' ? '🇬🇹 GT' : '🇸🇻 SV'} - Ext {cat.extension || 'N/A'})
                      </option>
                    ))
                  ) : (
                    <option value={editingTeamsItem.ejecutivo || 'Asesor'}>
                      {editingTeamsItem.ejecutivo || 'Asesor'}
                    </option>
                  )}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Fecha de la Reunión</label>
                  <input
                    type="date"
                    required
                    value={editingTeamsItem.fecha_reunion}
                    onChange={(e) => setEditingTeamsItem({ ...editingTeamsItem, fecha_reunion: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Hora de la Reunión</label>
                  <input
                    type="time"
                    required
                    value={editingTeamsItem.hora_reunion}
                    onChange={(e) => setEditingTeamsItem({ ...editingTeamsItem, hora_reunion: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Estado de la Reunión Teams</label>
                <select
                  value={editingTeamsItem.estado_teams}
                  onChange={(e) => setEditingTeamsItem({ ...editingTeamsItem, estado_teams: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-medium focus:outline-none focus:border-purple-500"
                >
                  <option value="Si se hizo y tiene evidencia">✅ Sí se hizo y tiene evidencia</option>
                  <option value="Si se hizo sin evidencia">⚠️ Sí se hizo pero sin evidencia grabada</option>
                  <option value="No se realizó / Prospecto no asistió">❌ No se realizó / Prospecto no asistió</option>
                  <option value="Reprogramada">🔄 Reprogramada para otra fecha</option>
                  <option value="Pendiente de realizar">⏳ Pendiente de realizar</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Enlace de Evidencia (Teams Recap / Grabación OneDrive / SharePoint)
                </label>
                <input
                  type="url"
                  placeholder="https://teams.microsoft.com/l/meetingrecap?..."
                  value={editingTeamsItem.evidencia_url}
                  onChange={(e) => setEditingTeamsItem({ ...editingTeamsItem, evidencia_url: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 font-mono text-[11px]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalTeamsAbierto(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoTeams}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold transition-all disabled:opacity-50 cursor-pointer shadow-lg shadow-purple-950"
                >
                  {guardandoTeams ? (
                    <span>Guardando...</span>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      <span>Guardar Registro Teams</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
