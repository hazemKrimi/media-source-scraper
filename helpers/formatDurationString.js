module.exports = (hours, minutes, seconds) => {
    return `${hours < 10 ? '0' + hours : hours ? hours : '00'}:${minutes < 10 ? '0' + minutes : minutes ? minutes : '00'}:${seconds < 10 ? '0' + seconds : seconds ? seconds : '00'}`;
};