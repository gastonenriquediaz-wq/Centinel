export interface EducationalSection {
  subtitle: string;
  body: string;
  examples?: string[];
  recommendations?: string[];
  recommendationsHeader?: string;
}

export interface EducationalTopic {
  id: string;
  title: string;
  shortDescription: string;
  icon: string; // Emoji o identificador de icono
  iconBg?: string; // Fondo para el icono según maqueta
  intro: string;
  sections: EducationalSection[];
  keyAdvice: string;
}

export const EDUCATIONAL_TOPICS: EducationalTopic[] = [
  {
    id: 'que-es-el-acoso-escolar',
    title: '¿Qué es el acoso escolar?',
    shortDescription: 'Definición, características y manifestaciones del acoso escolar.',
    icon: '📖',
    iconBg: '#EFF6FF',
    intro:
      'El acoso escolar (o bullying) es una forma de violencia que se da entre pares en el ámbito educativo. Conocer sus rasgos fundamentales nos ayuda a distinguirlo de desacuerdos cotidianos y a actuar a tiempo.',
    sections: [
      {
        subtitle: 'Características principales',
        body: 'De acuerdo con las orientaciones de la UNESCO (2020), el acoso escolar presenta tres características principales que permiten diferenciarlo de otros conflictos entre estudiantes:',
        recommendationsHeader: 'Características del acoso escolar:',
        recommendations: [
          'Intencionalidad: Hay una voluntad deliberada de dañar, intimidar o humillar.',
          'Reiteración: Las conductas hostiles se repiten a lo largo del tiempo.',
          'Desequilibrio de poder: Existe una asimetría real o percibida (física, social o psicológica) que dificulta que la persona afectada pueda defenderse por sí misma.',
        ],
      },
      {
        subtitle: 'Diferencia entre conflicto ocasional y acoso',
        body: 'En la convivencia escolar es normal que surjan diferencias, enojos o discusiones puntuales entre compañeros. Cuando dos personas tienen una disputa en igualdad de condiciones y sin una persecución sostenida, estamos ante un conflicto que puede resolverse mediante el diálogo. En el acoso escolar, en cambio, una de las partes queda sistemáticamente expuesta al hostigamiento sin posibilidad de frenarlo por sí sola.\n\nEs importante recordar que no todas las situaciones de violencia escolar constituyen acoso escolar. Sin embargo, una agresión aislada, una amenaza o un conflicto también pueden requerir atención e intervención de las autoridades educativas.\n\nNo es necesario que un estudiante determine por sí mismo si lo ocurrido constituye acoso escolar para comunicarlo o pedir ayuda.',
      },
      {
        subtitle: 'Formas habituales de manifestación',
        body: 'El acoso puede adoptar diversas modalidades:',
        examples: [
          'Verbal: Insultos reiterados, apodos degradantes, burlas ofensivas constantes.',
          'Físico: Empujones, golpes, tropiezos provocados, quita o rotura de pertenencias.',
          'Social o relacional: Exclusión organizada de grupos de trabajo o juegos, difusión de rumores con el fin de aislar a la persona.',
        ],
      },
    ],
    keyAdvice:
      'Si vos o alguien que conocés está atravesando una situación de acoso escolar, no la minimices.\n\nHablá con un adulto de confianza o con las autoridades de tu institución educativa. No tenés que resolverlo por tu cuenta.',
  },
  {
    id: 'que-es-el-ciberacoso',
    title: '¿Qué es el ciberacoso?',
    shortDescription: 'Situaciones de hostigamiento en redes sociales, mensajes y entornos digitales.',
    icon: '📱',
    iconBg: '#EFF6FF',
    intro:
      'El ciberacoso (o cyberbullying) ocurre cuando se utilizan tecnologías digitales —redes sociales, plataformas de mensajería, juegos en línea— para intimidar, avergonzar o agredir de forma sostenida a un estudiante.\n\nA diferencia de otras formas de acoso, en los entornos digitales una publicación ofensiva puede compartirse o difundirse numerosas veces, prolongando el daño causado. Por eso, incluso una situación aparentemente aislada puede requerir atención y acompañamiento.',
    sections: [
      {
        subtitle: 'Cómo suele manifestarse en entornos digitales',
        body: 'De acuerdo con guías de sensibilización sobre convivencia digital (UNICEF y Faro Digital, 2020), el ciberacoso puede incluir:',
        examples: [
          'Envío reiterado de mensajes amenazantes, despectivos o intimidatorios por canales privados o públicos.',
          'Creación de grupos o encuestas con el fin de burlarse, calificar negativamente o excluir a un compañero.',
          'Difusión de fotografías, videos, audios o información personal sin consentimiento, con la intención de avergonzar, humillar o perjudicar a otra persona.',
          'Suplantación de identidad en perfiles falsos para difamar o provocar conflictos.',
        ],
      },
      {
        subtitle: 'Pautas para el cuidado digital y conservación de evidencias',
        body: 'Si te enfrentás a agresiones digitales, es importante adoptar recaudos de protección:',
        recommendations: [
          'Guardar evidencias de forma segura: Si es posible y no te pone en riesgo, conservá capturas de pantalla de los mensajes o publicaciones, incluyendo la fecha y el remitente. Pedí ayuda a un adulto de confianza para hacerlo. No compartas ni difundas el contenido entre compañeros.',
          'Configurar privacidad: Bloqueá o silenciá cuentas agresoras y ajustá la visibilidad de tus perfiles a personas conocidas.',
          'Evitar responder con agresiones: Reaccionar en caliente suele amplificar el conflicto.',
          'Comunicarlo a adultos: Pedí orientación a tu familia, docentes o directivos.',
        ],
      },
    ],
    keyAdvice:
      'Lo que sucede en Internet puede afectar seriamente a las personas.\n\nSi vos o alguien que conocés está sufriendo ciberacoso, no respondas con agresiones ni difundas el contenido. Buscá ayuda de un adulto de confianza o de las autoridades de tu institución.',
  },
  {
    id: 'que-puedo-hacer-si-me-pasa-a-mi',
    title: '¿Qué puedo hacer si me pasa a mí?',
    shortDescription: 'Orientaciones para buscar acompañamiento y comunicar lo que sucede.',
    icon: '❤️',
    iconBg: '#FEE2E2',
    intro:
      'Atravesar una situación de hostigamiento puede generar angustia, temor o sensación de soledad. Saber que no tenés la culpa y que existen caminos de acompañamiento es fundamental para salir de esa situación.',
    sections: [
      {
        subtitle: 'Orientaciones generales para actuar',
        body: 'Ninguna persona merece ser maltratada. Te sugerimos considerar las siguientes pautas:',
        recommendations: [
          'No te aísles: El hostigamiento busca debilitar la confianza. Hablar con alguien de tu entorno permite aliviar la carga.',
          'Recurrir a un adulto de confianza: Puede ser tu mamá, papá, tutor, un profesor, el preceptor, directivos o profesionales de orientación escolar.',
          'Evitar enfrentamientos directos que eleven el riesgo: Responder con violencia física o verbal puede ponerte en mayor peligro o desviar la atención de la agresión original.',
          'Utilizar Centinel para informar a la escuela: Podés registrar lo sucedido desde la aplicación para que el equipo directivo tome conocimiento formal y pueda brindarte contención institucional.',
        ],
      },
    ],
    keyAdvice:
      'Pedir ayuda no es ser débil ni exagerar: es un acto de cuidado propio para que la escuela pueda activar los protocolos de resguardo y escucha.',
  },
  {
    id: 'que-puedo-hacer-si-le-pasa-a-otra-persona',
    title: '¿Qué puedo hacer si le pasa a otra persona?',
    shortDescription: 'Cómo actuar como testigo sin exponerse ni agravar la situación.',
    icon: '👥',
    iconBg: '#EFF6FF',
    intro:
      'El grupo de pares desempeña un papel determinante frente al acoso. La mirada de los testigos puede frenar el hostigamiento o, por el contrario, reforzarlo si se guarda silencio o se festejan las agresiones.',
    sections: [
      {
        subtitle: 'El rol de los observadores o testigos',
        body: 'La UNESCO y diversos organismos especializados señalan que el hostigamiento se sostiene cuando los agresores obtienen reconocimiento o complicidad del grupo. Por eso, modificar la respuesta grupal es una de las herramientas preventivas más poderosas.',
      },
      {
        subtitle: 'Pautas de acción responsable',
        body: 'Podés colaborar positivamente de las siguientes maneras:',
        recommendations: [
          'No amplificar el daño: No te rías, no compartas fotos, memes o comentarios que humillen a un compañero.',
          'Brindar apoyo cercano: Acercate a la persona afectada en los recreos o actividades cotidianas para que no se sienta sola.',
          'Avisar a un adulto responsable: Comunicar un hecho de violencia a los docentes o directivos no es "delatar", es un acto de empatía y cuidado mutuo.',
          'Utilizar Centinel como testigo: La aplicación te permite enviar un reporte indicando que la situación le ocurre a otra persona, resguardando la información dentro del canal directivo.',
        ],
      },
    ],
    keyAdvice:
      'Tu postura frente a una injusticia cuenta. Acompañar a un compañero y avisar a las autoridades puede marcar una diferencia decisiva para frenar el sufrimiento de otra persona.',
  },
  {
    id: 'cuando-pedir-ayuda',
    title: '¿Cuándo pedir ayuda?',
    shortDescription: 'Señales de preocupación y motivos para acudir a un adulto responsable.',
    icon: '💬',
    iconBg: '#FEF9C3',
    intro:
      'Muchas veces los adolescentes dudan antes de comunicar una situación por temor a equivocarse o a que se considere algo menor. Conocer los momentos oportunos para buscar acompañamiento previene situaciones de mayor gravedad.',
    sections: [
      {
        subtitle: 'No necesitás tener certezas absolutas para consultar',
        body: 'No hace falta que estés 100% seguro de si un hecho califica jurídicamente o reglamentariamente como "acoso escolar". Si una situación te provoca malestar reiterado, temor de asistir al colegio, aislamiento o dolor, ya existe un motivo suficiente para dialogar con los adultos.',
      },
      {
        subtitle: 'Señales de alerta que ameritan intervención temprana',
        body: 'Es momento de pedir ayuda ante las siguientes circunstancias:',
        examples: [
          'Sentimiento persistente de angustia o desgano antes de ir al colegio.',
          'Reiteradas bromas pesadas o comentarios hirientes que no se detienen aunque se pida parar.',
          'Amenazas, extorsiones o exigencias de dinero o pertenencias.',
          'Exclusión intencional que te deja sin grupo de trabajo o recreación de manera continua.',
        ],
      },
      {
        subtitle: 'Situaciones de urgencia o peligro inminente',
        body: 'Si existe riesgo físico inmediato, agresión violenta en curso o amenazas a la integridad física o psíquica grave, acudí presencialmente y de forma inmediata al adulto responsable más cercano, o recurrí a los servicios públicos de auxilio correspondientes (como la línea 911 o 102 de Protección a la Niñez y Adolescencia). Centinel es un canal de seguimiento y no sustituye la atención de emergencias en tiempo real.',
      },
    ],
    keyAdvice:
      'Buscar ayuda a tiempo evita que el conflicto escale. Los adultos de la escuela están para orientar y proteger el espacio compartido.',
  },
  {
    id: 'canales-institucionales-de-ayuda',
    title: 'Canales institucionales de ayuda',
    shortDescription:
      'Cómo solicitar apoyo del director o vicedirector y utilizar Centinel para comunicar situaciones.',
    icon: '🏫',
    iconBg: '#ECFDF5',
    intro:
      'Las escuelas cuentan con responsabilidades y procedimientos establecidos para resguardar a sus estudiantes. Conocer cómo funciona Centinel y cuáles son sus alcances te permite utilizarlo de manera informada y responsable.',
    sections: [
      {
        subtitle: 'El rol de los directivos escolares',
        body: 'El Director y el Vicedirector de tu institución educativa son las autoridades legalmente facultadas para intervenir, coordinar con docentes, citar a las familias, labrar actas de actuación y articular con equipos interdisciplinarios cuando sea necesario.',
      },
      {
        subtitle: 'Cómo funciona Centinel dentro de tu colegio',
        body: 'Centinel brinda un medio seguro para hacer llegar información a esas autoridades:',
        recommendations: [
          'Confidencial frente a compañeros: Ningún otro estudiante puede ver tus reportes, descripciones, evidencias o mensajes.',
          'No es anónimo: Para garantizar la seriedad de la comunicación y permitir que las autoridades puedan protegerte y dar seguimiento adecuado, los directivos conocen la identidad de quien reporta.',
          'Canal complementario: La aplicación facilita la comunicación escrita inicial y el registro de evidencias, pero complementa —y no sustituye— las reuniones presenciales, las instancias de escucha personal y las normativas institucionales.',
        ],
      },
    ],
    keyAdvice:
      'Centinel es una herramienta institucional para cuidarte. Usala con responsabilidad, veracidad y compromiso con el bienestar de toda la comunidad escolar.',
  },
  {
    id: 'convivencia-y-respeto',
    title: 'Convivencia y respeto',
    shortDescription: 'Empatía, inclusión, respeto y uso responsable de los medios digitales.',
    icon: '🤝',
    iconBg: '#EEF2FF',
    intro:
      'Una comunidad educativa saludable se construye con pequeñas actitudes cotidianas de reconocimiento hacia los demás, aceptando las diversidades como parte natural de la vida comunitaria.',
    sections: [
      {
        subtitle: 'Empatía y valoración de las diferencias',
        body: 'Cada persona tiene gustos, ritmos de aprendizaje, formas de expresarse y realidades familiares distintas. El respeto no exige que todos pensemos o seamos iguales, sino que reconozcamos el valor de la dignidad de cada compañero.',
      },
      {
        subtitle: 'Convivencia responsable en el entorno presencial y digital',
        body: 'Algunas prácticas positivas recomendadas por programas de convivencia escolar incluyen:',
        recommendations: [
          'Integrar a quienes están solos o son nuevos en el curso.',
          'Expresar desacuerdos de forma constructiva, sin recurrir a la burla pública ni al desprecio.',
          'Pedir permiso antes de subir o etiquetar fotos de otras personas.',
          'Reflexionar antes de comentar en redes sociales: preguntarse si lo que vamos a escribir suma o agrede.',
        ],
      },
    ],
    keyAdvice:
      'La convivencia armónica no significa ausencia de diferencias, sino la capacidad de resolverlas con diálogo, escucha activa y empatía.',
  },
];
