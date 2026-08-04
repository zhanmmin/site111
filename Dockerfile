FROM nginx:1.18.0

COPY . /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
