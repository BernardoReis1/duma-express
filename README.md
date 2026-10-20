# Duma Express

## Executar

É necessário Node.js 18 ou superior. Não há dependências externas:

```sh
node server.js
```

Abre `http://localhost:3000`. Para escolher outra porta, define a variável de ambiente `PORT`.

O layout adaptável de telemóveis e tablets está centralizado em `responsive.css` e aplicado a todas as páginas.

## Publicar no GitHub Pages

O workflow `.github/workflows/pages.yml` publica automaticamente o site ao fazer push para `main`. O catálogo é exportado do servidor durante a compilação e servido como `products.json`; os ficheiros do backend não são incluídos no site publicado.

O GitHub Pages é apenas alojamento estático: não executa `server.js` nem disponibiliza as APIs de newsletter, contactos, pedidos de criação de sites e encomendas. Por isso, essas operações não ficam registadas no servidor quando o site está publicado no Pages. Para usar essas funções, publica o backend Node.js num serviço compatível e configura a aplicação para usar esse serviço.

## API

- `GET /api/health` — estado do servidor.
- `GET /api/products` — catálogo com imagens, categorias, disponibilidade e marcas.
- `POST /api/newsletter` — recebe `{ "email": "cliente@example.com" }`.
- `POST /api/contact` — recebe `name`, `email`, `subject` e `message`.
- `POST /api/site-requests` — recebe os dados de contacto, tipo de site e descrição do projecto; guarda o pedido em `data/site-requests.jsonl`.
- `POST /api/orders` — recebe `name`, `email` e `items`, uma lista de `{ "name": "Sandália Hermes", "quantity": 1 }`. Os preços são calculados pelo servidor.

O catálogo combina os produtos actuais com as imagens de `img/`, evitando imagens repetidas. Os cartões mostram a marca; a colecção Longrich apresenta o preço como «sob consulta» e encaminha para o formulário de contacto.

As inscrições, mensagens e encomendas ficam em ficheiros JSON Lines na pasta `data/`, criada na primeira gravação. Essa pasta não é servida publicamente e está excluída do Git. O checkout regista a encomenda antes de abrir a mensagem e reutiliza o mesmo registo se o cliente escolher outro canal, evitando pedidos duplicados na mesma sessão da página.

Os formulários de contacto, criação de sites e encomendas registam o pedido no servidor e permitem preparar o envio por WhatsApp, email ou SMS. WhatsApp e SMS usam o número `+244 942 053 238`; o contacto da loja por email é `bernardogrup@gmail.com` e os pedidos de criação de sites por email são endereçados a `moscovodollar@gmail.com`. O envio abre a aplicação correspondente para o cliente rever e confirmar; o envio automático de email pelo servidor requer SMTP, que ainda não foi configurado.

## Testes

```sh
node --test
```
