FROM golang:1.23-alpine AS build

WORKDIR /src
COPY . .

RUN go build -o mustang

FROM alpine:3.21

RUN apk add --no-cache docker
EXPOSE 4000

COPY --from=build /src/mustang /mustang

ENTRYPOINT ["/mustang"]
