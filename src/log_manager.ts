const log_line = (msg_type: 'error' | 'warn' | 'log', text: string) => {
    const log_view = document.getElementById('logs');
    // Fixes scroll offsets for the log,
    // so that the latest log messages are always displayed.
    if (!log_view?.parentElement) {
        console.error(text);
        console.error('Failed to write log to log view');
        return;
    }
    const height =
        log_view.parentElement.scrollTop ==
        log_view.parentElement.scrollHeight -
            log_view.parentElement.offsetHeight;
    const message = document.createElement('p');
    message.textContent = text;
    if (msg_type === 'error') {
        message.classList.add('text-red-700');
    } else if (msg_type === 'warn') {
        message.classList.add('text-yellow-700');
    }
    log_view.append(message);
    if (height) {
        log_view.parentElement.scrollTop = log_view.parentElement.scrollHeight;
    }
};

export const log_msg = log_line.bind(undefined, 'log');
export const log_warning = log_line.bind(undefined, 'warn');
export const log_error = log_line.bind(undefined, 'error');
