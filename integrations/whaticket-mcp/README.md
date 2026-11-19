# Plugin local Whaticket MCP

Permite consultar e editar tickets e cards no ChatGPT/Codex desktop por um processo MCP local. O computador que executa o aplicativo precisa estar na mesma rede Headscale do servidor Whaticket. A integração não exige SSO e usa uma conta normal do Whaticket.

## Configuração

1. Instale Node.js 18 ou superior no computador cliente.
2. Confirme que `http://100.x.y.z:8080` (IP Headscale do servidor e porta do backend) abre **a partir desse computador**. Use HTTPS para nomes DNS; HTTP é aceito pelo plugin somente para `localhost` ou IP `100.64.0.0/10`.
3. Defina estas variáveis de ambiente no processo que inicia o cliente MCP:

   - `WHATICKET_URL`: URL base do backend, sem `/` final. Exemplo: `http://100.101.102.103:8080`.
   - `WHATICKET_EMAIL`: email de uma conta do Whaticket com acesso aos tickets.
   - `WHATICKET_PASSWORD`: senha dessa conta.

   Guarde a senha no gerenciador de credenciais do sistema ou no ambiente do cliente. Não salve credenciais no repositório, no manifesto ou em mensagens do ChatGPT.

4. Instale esta pasta como plugin **local** no cliente que aceita `mcp.json`, ou configure manualmente um servidor MCP `stdio` com comando `node` e argumento apontando para `server.mjs`. O arquivo `mcp.json` já contém a configuração portátil do plugin.
5. Reinicie o cliente e confira as ferramentas `listar_tickets`, `ver_ticket`, `editar_ticket`, `listar_cards`, `criar_card`, `editar_card` e `comentar_card`.

O processo faz login em `/auth/login`, mantém o token apenas em memória e renova a sessão por novo login quando necessário. As permissões são as da conta configurada. A rede Headscale controla quem alcança o backend; para tornar o serviço acessível **somente** pela rede privada, restrinja a publicação da porta 8080 no firewall/compose do servidor e permita apenas os nós autorizados nas ACLs do Headscale. O plugin local por si só não altera o firewall do servidor.

O servidor `stdio` é executado no próprio computador. O projeto inclui um marketplace local em `integrations/.agents/plugins/marketplace.json`. Para registrar esse catálogo no aplicativo, execute na raiz do repositório:

```powershell
codex plugin marketplace add ./integrations
```

Depois, reinicie o ChatGPT desktop, abra o diretório de Plugins, escolha **Whaticket local** e instale **Whaticket**. Configure `WHATICKET_URL`, `WHATICKET_EMAIL` e `WHATICKET_PASSWORD` no ambiente do processo local antes de iniciar o aplicativo. O computador precisa alcançar o backend pelo endereço Headscale. Não é necessário túnel nem endpoint público.

Concluir um card ligado a um ticket ou fechar um ticket pode disparar uma mensagem de despedida conforme a configuração do backend.
