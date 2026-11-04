// Pasos del recorrido guiado. Cada paso señala un elemento real de la pantalla (por atributo data-tour)
// y avanza solo cuando el usuario hace la acción: `isDone` se evalúa cada 150 ms.
const qs = (sel) => document.querySelector(sel);
const qsa = (sel) => Array.from(document.querySelectorAll(sel));
const last = (sel) => {
  const all = qsa(sel);
  return all.length ? all[all.length - 1] : null;
};

export function buildSteps(t) {
  return [
    {
      id: 'welcome',
      where: 'dashboard',
      title: t('¡Bienvenido a Ariadna!', 'Welcome to Ariadna!'),
      body: t(
        'Vamos a armar tu primer cronograma paso a paso. Tú haces cada acción y yo te voy guiando; toma unos 3 minutos.',
        "Let's build your first schedule step by step. You do each action and I'll guide you; it takes about 3 minutes."
      ),
      button: t('Comenzar', 'Start'),
    },
    {
      id: 'new-project',
      where: 'dashboard',
      target: () => qs('[data-tour="new-project"]'),
      placement: 'bottom',
      title: t('Crea un proyecto', 'Create a project'),
      body: t('Cada cronograma vive dentro de un proyecto. Empecemos creando el tuyo.', 'Each schedule lives inside a project. Let\'s start by creating yours.'),
      hint: t('Haz clic en «+ Nuevo proyecto»', 'Click "+ New project"'),
      isDone: () => !!qs('[data-tour="new-project-input"]'),
    },
    {
      id: 'project-name',
      where: 'dashboard',
      target: () => qs('[data-tour="new-project-input"]'),
      placement: 'bottom',
      title: t('Ponle nombre', 'Name it'),
      body: t('Escribe cómo se llama el proyecto, por ejemplo el nombre del cliente o de la obra.', "Type the project's name, for example the client or the job."),
      hint: t('Escribe un nombre (mínimo 2 letras)', 'Type a name (at least 2 letters)'),
      isDone: (b, ctx) => {
        if (ctx.pathname.startsWith('/proyectos/')) return true;
        const input = qs('[data-tour="new-project-input"]');
        return !!input && input.value.trim().length >= 2;
      },
    },
    {
      id: 'create-project',
      where: 'any',
      target: () => qs('[data-tour="create-project"]'),
      placement: 'top',
      title: t('Créalo', 'Create it'),
      body: t('Con el nombre listo, crea el proyecto. Te llevaré directo a su cronograma.', "With the name ready, create the project. I'll take you straight to its schedule."),
      hint: t('Haz clic en «Crear proyecto»', 'Click "Create project"'),
      isDone: (b, ctx) => ctx.pathname.startsWith('/proyectos/'),
    },
    {
      id: 'title',
      where: 'project',
      target: () => qs('[data-tour="project-title"]'),
      placement: 'bottom',
      title: t('El nombre del proyecto', 'The project name'),
      body: t(
        'Este es tu proyecto. Puedes cambiarle el nombre aquí cuando quieras. Todo se guarda solo, sin botón de guardar.',
        'This is your project. You can rename it here whenever you want. Everything saves automatically, there is no save button.'
      ),
      hint: t('Haz clic en el nombre', 'Click the name'),
      isDone: () => {
        const el = qs('[data-tour="project-title"]');
        return !!el && document.activeElement === el;
      },
    },
    {
      id: 'add-phase',
      where: 'project',
      target: () => qs('[data-tour="add-task"]'),
      placement: 'bottom',
      title: t('Agrega una fase', 'Add a phase'),
      body: t(
        'El cronograma se arma con fases, tareas y subtareas. Vamos a agregar una fase nueva al final.',
        'The schedule is built from phases, tasks and subtasks. Let\'s add a new phase at the end.'
      ),
      hint: t('Haz clic en «+ Agregar fase»', 'Click "+ Add phase"'),
      setup: () => (qs('[data-tour="add-task"]') && qsa('[data-tour="task-row"]').length > 0 ? { count: qsa('[data-tour="task-row"]').length } : undefined),
      isDone: (b) => qsa('[data-tour="task-row"]').length > b.count,
    },
    {
      id: 'name-phase',
      where: 'project',
      target: () => last('[data-tour="task-name"]'),
      placement: 'right',
      title: t('Nómbrala', 'Name it'),
      body: t('Escribe el nombre de la fase y presiona Enter (o haz clic fuera) para guardarlo.', 'Type the name of the phase and press Enter (or click outside) to save it.'),
      hint: t('Escribe un nombre y presiona Enter', 'Type a name and press Enter'),
      setup: () => {
        const el = last('[data-tour="task-name"]');
        return el ? { text: el.innerText.trim() } : undefined;
      },
      isDone: (b) => {
        const el = last('[data-tour="task-name"]');
        return !!el && el.innerText.trim() !== b.text && document.activeElement !== el;
      },
    },
    {
      id: 'duration',
      where: 'project',
      target: () => last('[data-tour="task-duration"]'),
      placement: 'right',
      title: t('Define la duración', 'Set the duration'),
      body: t(
        'La duración se mide en la unidad de tiempo del proyecto (por defecto, días). Cámbiala y la barra se ajusta sola.',
        "Duration is measured in the project's time unit (days by default). Change it and the bar adjusts by itself."
      ),
      hint: t('Cambia el número de duración', 'Change the duration number'),
      setup: () => {
        const el = last('[data-tour="task-duration"]');
        return el ? { value: el.value } : undefined;
      },
      isDone: (b) => {
        const el = last('[data-tour="task-duration"]');
        return !!el && el.value !== b.value;
      },
    },
    {
      id: 'move-bar',
      where: 'project',
      target: () => last('[data-tour="task-bar"]'),
      placement: 'bottom',
      title: t('Mueve la barra', 'Move the bar'),
      body: t(
        'Arrastra la barra hacia la derecha para decidir cuándo empieza esta fase. Si mueves una fase, sus subtareas se mueven con ella.',
        'Drag the bar to the right to decide when this phase starts. If you move a phase, its subtasks move with it.'
      ),
      hint: t('Arrastra la barra', 'Drag the bar'),
      setup: () => {
        const el = last('[data-tour="task-bar"]');
        return el ? { left: el.style.left } : undefined;
      },
      isDone: (b) => {
        const el = last('[data-tour="task-bar"]');
        return !!el && el.style.left !== b.left;
      },
    },
    {
      id: 'deliverable',
      where: 'project',
      target: () => qs('[data-tour="add-deliverable"]'),
      placement: 'top',
      title: t('Agrega un entregable', 'Add a deliverable'),
      body: t(
        'Los entregables son los hitos que recibe tu cliente. Aparecen como banderas rojas en el cronograma.',
        'Deliverables are the milestones your client receives. They appear as red flags on the schedule.'
      ),
      hint: t('Haz clic en el botón para agregar un entregable', 'Click the button to add a deliverable'),
      setup: () => (qs('[data-tour="add-deliverable"]') ? { count: qsa('[data-tour="deliverable-row"]').length } : undefined),
      isDone: (b) => qsa('[data-tour="deliverable-row"]').length > b.count,
    },
    {
      id: 'export',
      where: 'project',
      target: () => qs('[data-testid="open-export"]'),
      placement: 'bottom',
      title: t('Descarga tu cronograma', 'Download your schedule'),
      body: t('Cuando termines, expórtalo en el formato que necesites.', 'When you are done, export it in the format you need.'),
      hint: t('Haz clic en «Exportar»', 'Click "Export"'),
      isDone: () => !!qs('[data-testid="export-dialog"]'),
    },
    {
      id: 'export-formats',
      where: 'project',
      target: () => qs('[data-testid="export-dialog"]'),
      placement: 'left',
      title: t('Elige el formato', 'Choose the format'),
      body: t(
        'PDF con membrete para anexos, Word para insertarlo en otros documentos y PNG para pegarlo como imagen. No hace falta descargar nada ahora.',
        'PDF with letterhead for appendices, Word to insert into other documents and PNG to paste as an image. There is no need to download anything now.'
      ),
      hint: t('Haz clic en «Cerrar»', 'Click "Close"'),
      isDone: () => !qs('[data-testid="export-dialog"]'),
    },
    {
      id: 'user-menu',
      where: 'any',
      target: () => qs('[data-testid="user-menu-button"]'),
      placement: 'bottom',
      title: t('Tu menú', 'Your menu'),
      body: t('Aquí están tu cuenta y tus preferencias.', 'Your account and preferences are here.'),
      hint: t('Haz clic en tu nombre', 'Click your name'),
      isDone: () => !!qs('[data-testid="user-menu"]'),
    },
    {
      id: 'repeat',
      where: 'any',
      target: () => qs('[data-tour="repeat-tutorial"]'),
      placement: 'left',
      blockTarget: true,
      title: t('¡Todo listo!', "You're all set!"),
      body: t(
        'Desde este menú cambias el idioma y el tema, cierras sesión y puedes volver a ver este tutorial cuando quieras con «Repetir tutorial». Tu primer proyecto ya está creado: sigue armándolo o bórralo desde Mis proyectos.',
        'From this menu you change the language and theme, sign out, and can watch this tutorial again whenever you want with "Repeat tutorial". Your first project is already created: keep building it or delete it from My projects.'
      ),
      button: t('Terminar', 'Finish'),
      final: true,
    },
  ];
}
