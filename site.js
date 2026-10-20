async function enviarFormulario(url, dados) {
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados)
    });
    const resultado = await response.json();
    if (!response.ok) {
        throw new Error(resultado.error || "Não foi possível enviar os dados.");
    }
    return resultado;
}

const messagePhoneWhatsApp = "244942053238";
const messagePhoneSms = "+244942053238";

function criarLinkMensagem(channel, recipient, subject, message) {
    const encodedMessage = encodeURIComponent(message);
    if (channel === "whatsapp") {
        return `https://wa.me/${messagePhoneWhatsApp}?text=${encodedMessage}`;
    }
    if (channel === "sms") {
        return `sms:${messagePhoneSms}?body=${encodedMessage}`;
    }
    return `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodedMessage}`;
}

function abrirJanelaMensagem() {
    return window.open("about:blank", "_blank");
}

function navegarMensagem(messageWindow, url) {
    if (!messageWindow) return;
    messageWindow.location.href = url;
}

const newsletterForm = document.getElementById("newsletterForm");
if (newsletterForm) {
    newsletterForm.addEventListener("submit", async event => {
        event.preventDefault();
        if (!newsletterForm.reportValidity()) return;

        const status = document.getElementById("newsletterStatus");
        const button = newsletterForm.querySelector('button[type="submit"]');
        button.disabled = true;
        status.textContent = "A registar a inscrição…";
        try {
            const result = await enviarFormulario("/api/newsletter", {
                email: newsletterForm.elements.email.value.trim()
            });
            status.textContent = result.message;
            newsletterForm.reset();
        } catch (error) {
            status.textContent = error.message;
        } finally {
            button.disabled = false;
        }
    });
}

const contactForm = document.getElementById("contactForm");
if (contactForm) {
    contactForm.addEventListener("submit", async event => {
        event.preventDefault();
        if (!contactForm.reportValidity()) return;

        const status = document.getElementById("contactStatus");
        const channel = event.submitter?.value;
        if (!["whatsapp", "email", "sms"].includes(channel)) {
            status.textContent = "Escolhe WhatsApp, email ou SMS para enviar a mensagem.";
            return;
        }

        const data = {
            name: contactForm.elements.Nome.value.trim(),
            email: contactForm.elements.Email.value.trim(),
            subject: contactForm.elements.Assunto.value,
            message: contactForm.elements.Mensagem.value.trim()
        };
        const message = [
            `Nome: ${data.name}`,
            `Email: ${data.email}`,
            `Assunto: ${data.subject}`,
            "",
            data.message
        ].join("\n");
        const messageWindow = abrirJanelaMensagem();
        const buttons = contactForm.querySelectorAll('button[type="submit"]');
        const channelLink = document.getElementById("contactChannelLink");
        buttons.forEach(button => { button.disabled = true; });
        channelLink.hidden = true;
        status.textContent = "A enviar a mensagem…";
        try {
            const result = await enviarFormulario("/api/contact", data);
            const channelLabel = channel === "whatsapp" ? "WhatsApp" : channel === "sms" ? "SMS" : "email";
            channelLink.href = criarLinkMensagem(channel, "bernardogrup@gmail.com", data.subject, message);
            channelLink.textContent = `Abrir ${channelLabel} e enviar mensagem`;
            channelLink.hidden = false;
            navegarMensagem(messageWindow, channelLink.href);
            status.textContent = `${result.message} ${messageWindow ? `A confirmar o envio por ${channelLabel}.` : `Se a aplicação não abrir, usa o botão “Abrir ${channelLabel} e enviar mensagem”.`}`;
            contactForm.reset();
        } catch (error) {
            if (messageWindow) messageWindow.close();
            status.textContent = error.message;
        } finally {
            buttons.forEach(button => { button.disabled = false; });
        }
    });
}

const siteRequestForm = document.getElementById("siteRequestForm");
if (siteRequestForm) {
    siteRequestForm.addEventListener("submit", async event => {
        event.preventDefault();
        if (!siteRequestForm.reportValidity()) return;

        const status = document.getElementById("siteRequestStatus");
        const channelLink = document.getElementById("siteRequestChannelLink");
        const channel = event.submitter?.value;
        if (!["whatsapp", "email", "sms"].includes(channel)) {
            status.textContent = "Escolhe WhatsApp, email ou SMS para enviar o pedido.";
            return;
        }

        const data = {
            name: siteRequestForm.elements.name.value.trim(),
            email: siteRequestForm.elements.email.value.trim(),
            phone: siteRequestForm.elements.phone.value.trim(),
            business: siteRequestForm.elements.business.value.trim(),
            projectType: siteRequestForm.elements.projectType.value,
            budget: siteRequestForm.elements.budget.value,
            details: siteRequestForm.elements.details.value.trim()
        };
        const messageWindow = abrirJanelaMensagem();
        const buttons = siteRequestForm.querySelectorAll('button[type="submit"]');

        buttons.forEach(button => { button.disabled = true; });
        channelLink.hidden = true;
        status.textContent = "A registar o teu pedido…";
        try {
            const result = await enviarFormulario("/api/site-requests", data);
            const subject = `Pedido de criação de site — ${data.name}`;
            const message = [
                "Novo pedido de criação de site",
                "",
                `Nome: ${data.name}`,
                `Email: ${data.email}`,
                `Telefone/WhatsApp: ${data.phone || "Não indicado"}`,
                `Negócio: ${data.business || "Não indicado"}`,
                `Tipo de site: ${data.projectType}`,
                `Orçamento previsto: ${data.budget || "A combinar"}`,
                "",
                "Sobre o projecto:",
                data.details,
                "",
                `Referência do pedido: ${result.requestId}`
            ].join("\n");
            const channelLabel = channel === "whatsapp" ? "WhatsApp" : channel === "sms" ? "SMS" : "email";
            channelLink.href = criarLinkMensagem(channel, "moscovodollar@gmail.com", subject, message);
            channelLink.textContent = `Abrir ${channelLabel} e enviar pedido`;
            channelLink.hidden = false;
            navegarMensagem(messageWindow, channelLink.href);
            status.textContent = `${result.message} ${messageWindow ? `A confirmar o envio por ${channelLabel}.` : `Se a aplicação não abrir, usa o botão “Abrir ${channelLabel} e enviar pedido”.`}`;
            siteRequestForm.reset();
        } catch (error) {
            if (messageWindow) messageWindow.close();
            status.textContent = error.message;
        } finally {
            buttons.forEach(button => { button.disabled = false; });
        }
    });
}
