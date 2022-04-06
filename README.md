# SystemLink Notebook Data Source

[![Build](https://github.com/ni/systemlink-notebook-datasource/workflows/CI/badge.svg)](https://github.com/ni/systemlink-notebook-datasource/actions?query=workflow%3A%22CI%22)

A Grafana plugin for SystemLink Enterprise, used for executing Jupyter notebooks and retrieving their results.

## Getting started

1. Install dependencies

   ```bash
   yarn install
   ```

2. Build plugin in development mode or run in watch mode

   ```bash
   yarn dev
   ```

   or

   ```bash
   yarn watch
   ```

3. Build plugin in production mode

   ```bash
   yarn build
   ```

## Connecting to enterprise-dev for local development

The NbParsingService does not have an ingress defined, so you must use port forwarding and [add a proxy route](https://grafana.com/docs/grafana/latest/developers/plugins/add-authentication-for-data-source-plugins/#add-a-proxy-route-to-your-plugin) to plugin.json:

```json
"routes": [
   {
      "path": "ninbparser",
      "url": "http://localhost:<port>/ninbparser"
   }
]
```
## Learn more

- [Build a data source plugin tutorial](https://grafana.com/tutorials/build-a-data-source-plugin)
- [Grafana documentation](https://grafana.com/docs/)
- [Grafana Tutorials](https://grafana.com/tutorials/) - Grafana Tutorials are step-by-step guides that help you make the most of Grafana
- [Grafana UI Library](https://developers.grafana.com/ui) - UI components to help you build interfaces using Grafana Design System
