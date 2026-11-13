import { CONTATO, RESPONSAVEL } from '@/contact'

export type Block = { h: string; p?: string[]; ul?: string[]; links?: { label: string; url: string }[] }
export const LEGAL_UPDATED = '10 de novembro de 2026'
const quem = `${RESPONSAVEL.nome}${RESPONSAVEL.documento ? ' (' + RESPONSAVEL.documento + ')' : ''}`

export const DOCS: Record<string, { title: string; intro: string; blocks: Block[] }> = {
  privacidade: {
    title: 'Política de Privacidade',
    intro: 'Esta política explica quais dados o Sules Control trata, para quê, com quem compartilha e quais são os seus direitos, de acordo com a Lei Geral de Proteção de Dados (LGPD, Lei 13.709/2018).',
    blocks: [
      { h: 'Quem somos', p: [`O Sules Control é um sistema web de gestão de vendas, comissões e conferência de produção para corretores de seguro auto. O responsável pelo sistema é ${quem}.`, `Canal de contato e encarregado pelo tratamento de dados: ${CONTATO.email}.`] },
      { h: 'Papéis no tratamento', p: ['Em relação aos dados dos clientes cadastrados pelo corretor, o corretor que usa a conta é o controlador, e o Sules Control atua como operador, tratando os dados conforme as instruções do corretor.', 'Em relação aos dados da própria conta (e-mail de acesso, nome e e-mail do corretor, configurações), o responsável pelo sistema atua como controlador.'] },
      { h: 'Dados que tratamos', ul: [
        'Conta e acesso: e-mail de login, senha (guardada somente em formato protegido pelo provedor de autenticação), nome e e-mail do corretor, preferências.',
        'Dados de clientes inseridos pelo corretor: nome, CPF, telefone, e-mail, CEP e endereço (cidade, estado), placa do veículo, números de proposta e apólice, valores, observações e o PDF da proposta.',
        'Dados técnicos de segurança: endereço IP, data e hora de acesso e registros de alterações, mantidos pelos provedores e pelo sistema.',
        'Agenda: atendimentos e recontatos marcados por você (data, hora, cliente, assunto e observações).',
        'Mensagens digitadas no assistente de chat, quando esse recurso está ativado.',
        'Não solicitamos dados pessoais sensíveis (como saúde ou biometria). Pedimos que você não os insira nos campos livres.'] },
      { h: 'Finalidades e bases legais', ul: [
        'Operar o sistema, cadastrar vendas, calcular comissões e gerar relatórios (execução de contrato e de procedimentos preliminares, art. 7º, V).',
        'Cumprir obrigações legais e regulatórias da atividade de corretagem, como guarda de registros (art. 7º, II).',
        'Exercício regular de direitos em processos judiciais, administrativos ou arbitrais (art. 7º, VI).',
        'Segurança, prevenção a fraudes e melhoria do sistema (legítimo interesse, art. 7º, IX).',
        'Consentimento, quando a lei o exigir para uma finalidade específica (art. 7º, I).'] },
      { h: 'Com quem compartilhamos', p: ['Não vendemos dados pessoais. Usamos prestadores (operadores) para fazer o sistema funcionar:'], ul: [
        'Supabase: banco de dados, autenticação, armazenamento de arquivos e funções de servidor.',
        'Vercel: hospedagem do site.',
        'Provedor da caixa de e-mail do corretor (Titan/HostGator): envio do e-mail automático com os dados da venda ao destinatário configurado (por exemplo, o RH).',
        'Anthropic: processamento das mensagens do assistente de chat, quando ativado.',
        'ViaCEP: serviço público de consulta de endereço, que recebe apenas o CEP digitado.',
        'Destinatários que o próprio corretor escolher, como o RH ou a seguradora.'] },
      { h: 'Transferência internacional', p: ['Alguns prestadores mantêm servidores fora do Brasil, inclusive nos Estados Unidos. Esses envios ocorrem para operar o serviço, com as salvaguardas contratuais oferecidas pelos próprios prestadores, conforme o art. 33 da LGPD.'] },
      { h: 'Segurança', ul: [
        'Conexão protegida por HTTPS/TLS entre o navegador e o site, e entre o site e o banco de dados.',
        'Criptografia dos dados em repouso pela infraestrutura dos provedores, conforme informado por eles.',
        'Controle de acesso por usuário: cada conta enxerga apenas os próprios dados (regras de segurança em nível de linha no banco).',
        'Propostas em PDF guardadas em espaço privado, abertas por links temporários.',
        'Limites de tentativas e de requisições (rate limiting) e cadastro público de novas contas desativado.',
        'Nenhum sistema é totalmente imune a falhas. Em caso de incidente que possa causar risco ou dano relevante, comunicaremos os envolvidos e a ANPD, conforme a LGPD (art. 48).'] },
      { h: 'Por quanto tempo guardamos os dados', p: ['Mantemos os dados enquanto a conta estiver ativa e pelo tempo necessário para cumprir obrigações legais ou exercer direitos. Registros excluídos pelo usuário saem do sistema; cópias de segurança mantidas pelos provedores podem existir por um prazo limitado definido por eles.'] },
      { h: 'Seus direitos (art. 18)', p: ['Você pode pedir: confirmação de que tratamos seus dados, acesso, correção, anonimização, bloqueio ou eliminação de dados desnecessários, portabilidade, informação sobre com quem compartilhamos, revogação do consentimento e oposição a tratamentos feitos com base em legítimo interesse.', `Envie o pedido para ${CONTATO.email}. Respondemos em até 15 dias. Se você é cliente de um corretor, o pedido também pode ser dirigido a ele, que é o controlador dos seus dados, e nós o ajudaremos a atendê-lo. Você também pode peticionar à Autoridade Nacional de Proteção de Dados (ANPD).`] },
      { h: 'Cookies e armazenamento local', p: ['Usamos apenas armazenamento essencial do navegador, sem rastreamento nem publicidade. Os detalhes estão no Aviso de cookies.'] },
      { h: 'Crianças e adolescentes', p: ['O sistema é destinado a profissionais maiores de 18 anos e não é voltado ao tratamento de dados de crianças e adolescentes.'] },
      { h: 'Alterações', p: ['Podemos atualizar esta política. A data da última atualização fica no topo desta página, e mudanças relevantes serão informadas no sistema.'] },
    ],
  },
  termos: {
    title: 'Termos de Serviço',
    intro: 'Ao usar o Sules Control você concorda com estes termos. Leia também a Política de Privacidade.',
    blocks: [
      { h: 'O serviço', p: ['O Sules Control é uma ferramenta de apoio à gestão de vendas, comissões e conferência de produção de seguro auto. Ele não é uma seguradora, não emite apólices e não substitui os sistemas e extratos oficiais da seguradora.'] },
      { h: 'Conta e acesso', ul: ['O acesso é individual e pessoal, mediante conta criada pelo responsável pelo sistema.', 'Você é responsável por manter a senha em sigilo e por tudo o que ocorrer na sua conta.', 'Avise-nos imediatamente, pelo canal de contato, se suspeitar de acesso indevido.'] },
      { h: 'Uso permitido', p: ['Use o sistema apenas para a sua atividade profissional e de acordo com a lei. É proibido:'], ul: ['tentar acessar dados de outros usuários ou burlar controles de segurança;', 'sobrecarregar o sistema, automatizar acessos abusivos ou tentar descobrir senhas;', 'inserir conteúdo ilícito ou dados sem base legal para tratá-los.'] },
      { h: 'Dados dos seus clientes', p: ['Você é o controlador dos dados dos seus clientes inseridos no sistema. É sua responsabilidade ter base legal para tratá-los, informar seus clientes sobre o uso dos dados e inserir apenas o necessário. Não insira dados pessoais sensíveis.'] },
      { h: 'Cálculos, projeções e relatórios', p: ['Comissões, projeções, metas e relatórios são estimativas calculadas com os dados que você informa. Confira sempre com o extrato da seguradora. Projeções não são garantia de resultado, e os relatórios não têm valor fiscal ou contábil por si só.'] },
      { h: 'Assistente de chat com IA', p: ['As respostas são geradas por inteligência artificial e podem conter erros. Revise antes de enviar a qualquer cliente e não inclua dados pessoais de clientes nas mensagens. O conteúdo é processado por prestador externo, conforme a Política de Privacidade.'] },
      { h: 'E-mails automáticos', p: ['O sistema pode enviar os dados da venda, e o PDF anexado, ao destinatário que você configurar. Você é responsável por escolher destinatários autorizados a receber essas informações.'] },
      { h: 'Marcas e propriedade intelectual', p: ['Marcas, nomes e imagens de terceiros, como Suhai Seguradora, pertencem aos seus titulares e aparecem apenas para identificar a atividade do corretor. Não indicam parceria, vínculo ou endosso, salvo autorização expressa do titular. O código e o design do sistema pertencem ao responsável por ele.'] },
      { h: 'Disponibilidade e backups', p: ['O serviço é oferecido sem garantia de funcionamento ininterrupto e pode ficar indisponível por manutenção ou por falhas de terceiros. Mantenha cópias dos seus dados: o sistema oferece o backup completo em Relatórios, e você é responsável por baixá-lo periodicamente.'] },
      { h: 'Limitação de responsabilidade', p: ['Na máxima extensão permitida pela lei, não nos responsabilizamos por perdas indiretas, lucros cessantes ou decisões tomadas com base nas estimativas do sistema. Isso não exclui responsabilidades que a lei não permita limitar.'] },
      { h: 'Suspensão e encerramento', p: ['Podemos suspender ou encerrar contas em caso de violação destes termos ou de risco à segurança. Você pode pedir o encerramento da conta e a exclusão dos seus dados pelo canal de contato.'] },
      { h: 'Alterações, lei e foro', p: ['Podemos alterar estes termos, informando no sistema. Eles são regidos pelas leis do Brasil, e fica eleito o foro do domicílio do usuário para dirimir eventuais conflitos, quando a lei assim determinar, ou o foro da comarca do responsável pelo sistema nos demais casos.'] },
    ],
  },
  creditos: {
    title: 'Créditos e licenças',
    intro: 'O Sules Control usa materiais de terceiros, listados aqui com o crédito de cada autor.',
    blocks: [
      { h: 'Mapa do Brasil', p: [
        'Autor: Felipe Menegaz (usuário João Felipe C.S, Wikimedia Commons). Arquivo: "Brazil Political Map.svg", publicado em dezembro de 2007.',
        'Licença: Creative Commons Atribuição-CompartilhaIgual 3.0 Não Adaptada (CC BY-SA 3.0).',
        'Alterações feitas por este sistema: os contornos dos estados foram simplificados, recoloridos conforme as vendas e reposicionados com siglas. O resultado (arquivo de contornos usado no mapa do dashboard) é distribuído sob a mesma licença, CC BY-SA 3.0.'],
        links: [{ label: 'Página do arquivo original (Wikimedia Commons)', url: 'https://commons.wikimedia.org/wiki/File:Brazil_Political_Map.svg' }, { label: 'Licença CC BY-SA 3.0', url: 'https://creativecommons.org/licenses/by-sa/3.0/deed.pt-br' }] },
      { h: 'Fonte de letra', p: ['Inter, © The Inter Project Authors, distribuída sob a SIL Open Font License 1.1.'], links: [{ label: 'rsms.me/inter', url: 'https://rsms.me/inter/' }, { label: 'SIL OFL 1.1', url: 'https://openfontlicense.org/' }] },
      { h: 'Ícones', p: ['Os ícones da interface são baseados na biblioteca Lucide, licença ISC.'], links: [{ label: 'lucide.dev', url: 'https://lucide.dev/' }] },
      { h: 'Consulta de CEP', p: ['Endereços obtidos pelo serviço público ViaCEP, a partir do CEP digitado.'], links: [{ label: 'viacep.com.br', url: 'https://viacep.com.br/' }] },
      { h: 'Software livre', p: ['O sistema é construído com bibliotecas de código aberto, como Vue, Vite, Tailwind CSS, Chart.js, Pinia, Supabase, jsPDF, pdf.js e SheetJS, cada uma sob a sua própria licença (principalmente MIT e Apache-2.0).'] },
    ],
  },
  cookies: {
    title: 'Aviso de cookies',
    intro: 'O Sules Control não usa cookies de publicidade, de rastreamento nem de análise de audiência. Usamos apenas o armazenamento do seu navegador (localStorage) para o sistema funcionar.',
    blocks: [
      { h: 'O que guardamos no seu navegador', ul: [
        'Sessão de login (chave que começa com "sb-"): mantém você conectado de forma segura. Essencial.',
        'sc-theme-v2: tema claro ou escuro escolhido. Preferência.',
        'sc-nav: se o menu lateral está recolhido. Preferência.',
        'sc-last-backup: data do último backup baixado, para o lembrete no dashboard. Preferência.',
        'sc-cookies-ok: registra que você viu este aviso.',
        'sc-login-fails e sc-login-lock: controle de tentativas de login, para segurança.'] },
      { h: 'Serviços de terceiros', p: ['As fontes de letra são servidas pelo próprio site, sem chamadas ao Google. As conexões ao banco de dados vão ao Supabase, que pode registrar o endereço IP para segurança. Ao digitar um CEP, ele é enviado ao ViaCEP para buscar o endereço.'] },
      { h: 'Como apagar', p: ['Você pode apagar esses dados nas configurações do navegador (limpar dados do site). Ao apagar a sessão, será preciso entrar de novo. Como usamos apenas armazenamento essencial e preferências, não pedimos consentimento para ele.'] },
    ],
  },
}
