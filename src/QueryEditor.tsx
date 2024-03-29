/**
 * QueryEditor is a React component that implements the UI for building a notebook query
 * when editing a Grafana panel.
 */
import _ from 'lodash';
import React, { PureComponent } from 'react';
import { Alert, Field, Input, Select, Label, IconButton, TextArea, LoadingPlaceholder, AsyncSelect, LoadOptionsCallback } from '@grafana/ui';
import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { DataSource } from './datasource';
import {
  NotebookDataSourceOptions,
  NotebookQuery,
  defaultQuery,
  Notebook,
  NotebookWithMetadata,
  isNotebookWithMeta,
} from './types';
import { TestResultsQueryBuilder } from './QueryBuilder';
import './QueryEditor.scss';
import { formatNotebookOption } from 'utils';

type Props = QueryEditorProps<DataSource, NotebookQuery, NotebookDataSourceOptions>;
type State = {
  loadingMetadata: boolean;
  queryError: string;
  showTextQuery: boolean;
};

export class QueryEditor extends PureComponent<Props, State> {
  notebookMetadata: Record<string, Notebook> = {};

  constructor(props: Props) {
    super(props);
    this.state = {
      loadingMetadata: false,
      queryError: '',
      showTextQuery: false,
    };
  }

  handleError = (e: Error) => {
    const error: string = (e as Error).message || 'SystemLink Notebook datasource failed to connect.';
    this.setState({ queryError: error });
  }

  loadNotebookOptions = _.debounce((query: string, cb?: LoadOptionsCallback<string>) => {
    this.props.datasource
      .queryNotebooks(query)  
      .then((notebooks) => {
        notebooks.forEach(notebook => this.notebookMetadata[notebook.id] = notebook);
        cb?.(notebooks.map(formatNotebookOption));
      })
      .catch(this.handleError);
  }, 300);

  async componentDidMount() {
    try {
      if (this.props.query.id) {
        const notebook = await this.props.datasource.getNotebook(this.props.query.id);
        if (notebook) {
          await this.populateNotebookMetadata(notebook);
        }
      }
    } catch (e) {
      this.handleError(e as Error);
    }
  }

  getNotebook = (id: string) => {
    return this.notebookMetadata[id];
  };

  populateNotebookMetadata = async (notebook: Notebook) => {
    try {
      this.setState({ loadingMetadata: true, queryError: '' });
      const metadata = await this.props.datasource.getNotebookMetadata(notebook.id);
      this.notebookMetadata[notebook.id] = Object.assign(notebook, metadata);
    } catch (e) {
      this.setState({ queryError: (e as Error).message });
    } finally {
      this.setState({ loadingMetadata: false });
    }
  };

  formatOutputOption = (output: any): SelectableValue => {
    return { label: output.display_name, value: output.id };
  };

  onNotebookChange = async (option: SelectableValue) => {
    const { onChange, onRunQuery, query } = this.props;
    let selectedNotebook = this.getNotebook(option.value)!;

    // Add metadata to notebook if it's not already there
    if (!isNotebookWithMeta(selectedNotebook)) {
      await this.populateNotebookMetadata(selectedNotebook);
    }

    // We now know the notebook has metadata, but TS can't infer from mutations
    const notebook = selectedNotebook as NotebookWithMetadata;

    // Preseve matching parameter values
    const oldNotebook = this.getNotebook(query.id);
    const parameters = _.pickBy(query.parameters, (value: any, id: string) => {
      const newParam = notebook.metadata.parameters.find((param: any) => param.id === id);
      if (!newParam) {
        return false;
      }

      if (newParam.options) {
        return (typeof value === 'string' && value.startsWith('$')) || newParam.options.includes(value);
      }

      if (oldNotebook && isNotebookWithMeta(oldNotebook)) {
        const oldParam = oldNotebook.metadata.parameters.find((param: any) => param.id === id);
        return oldParam.type === newParam.type;
      }
    });

    onChange({
      ...query,
      parameters,
      id: notebook.id,
      workspace: notebook.workspace,
      output: notebook.metadata ? notebook.metadata.outputs[0].id : '',
    });
    onRunQuery();
  };

  onParameterChange = (notebook: NotebookWithMetadata, id: string, value: string) => {
    const { onChange, onRunQuery, query } = this.props;
    const formattedValue = this.formatParameterValue(notebook, id, value);
    onChange({ ...query, parameters: { ...query.parameters, [id]: formattedValue } });
    onRunQuery();
  };

  onOutputChange = (option: SelectableValue) => {
    const { onChange, onRunQuery, query } = this.props;
    onChange({ ...query, output: option.value });
    onRunQuery();
  };

  onCacheTimeoutChange = (event: React.FocusEvent<HTMLInputElement>) => {
    const { onChange, onRunQuery, query } = this.props;
    onChange({ ...query, cacheTimeout: parseInt(event.target.value, 10) });
    onRunQuery();
  };

  formatParameterValue = (notebook: NotebookWithMetadata, id: string, value: string) => {
    const param = notebook.metadata.parameters.find((param: any) => param.id === id);
    if (!param) {
      return value;
    }

    switch (param.type) {
      case 'number':
        return Number(value);
      default:
        return value;
    }
  };

  getParameter = (notebook: NotebookWithMetadata, param: any) => {
    const { query } = this.props;
    const value = query?.parameters[param.id] || notebook?.parameters[param.id];
    if (param.type === 'test_monitor_result_query') {
      return (
        <div key={param.id + notebook.name}>
          <div className="sl-label-button">
            <Label>{param.display_name}</Label>
            <IconButton
              name={this.state.showTextQuery ? 'list-ul' : 'pen'}
              size="sm"
              onClick={() => this.setState({ showTextQuery: !this.state.showTextQuery })}
            />
          </div>
          {this.state.showTextQuery ? (
            <TextArea
              defaultValue={value}
              onBlur={(event) => this.onParameterChange(notebook, param.id, event.target.value)}
            />
          ) : (
            <TestResultsQueryBuilder
              autoComplete={this.props.datasource.queryTestResultValues.bind(this.props.datasource)}
              onChange={(event: any) => this.onParameterChange(notebook, param.id, event.detail.linq)}
              defaultValue={value}
            />
          )}
        </div>
      );
    }

    return (
      <div className="sl-parameter" key={param.id + notebook.name}>
        <Label className="sl-parameter-label">{param.display_name}</Label>
        {this.getParameterInput(notebook, param, value)}
      </div>
    );
  };

  getParameterInput = (notebook: NotebookWithMetadata, param: any, value: any) => {
    if (param.options) {
      let options = param.options.map((option: string) => ({ label: option, value: option }));

      if (param.type === 'string') {
        options = options.concat(this.getVariableOptions());
      }

      return (
        <Select
          className="sl-parameter-value"
          options={options}
          onChange={(event) => this.onParameterChange(notebook, param.id, event.value as string)}
          defaultValue={{ label: value, value }}
          menuPlacement="auto"
          maxMenuHeight={110}
        />
      );
    } else {
      return (
        <Input
          className="sl-parameter-value"
          onBlur={(event) => this.onParameterChange(notebook, param.id, event.target.value)}
          type={param.type === 'number' ? 'number' : 'text'}
          defaultValue={value}
        />
      );
    }
  };

  getVariableOptions() {
    return getTemplateSrv()
      .getVariables()
      .map((variable) => ({ label: '$' + variable.name, value: '$' + variable.name }));
  }

  render() {
    const query = { ...defaultQuery, ...this.props.query };
    const selectedNotebook = this.getNotebook(query.id);
    const notebookMetaLoaded = selectedNotebook && isNotebookWithMeta(selectedNotebook);
    return (
      <div className="sl-notebook-query-editor">
        <Field label="Notebook" className="sl-notebook-selector">
          <AsyncSelect
            cacheOptions={false}
            defaultOptions
            loadOptions={this.loadNotebookOptions}
            onChange={this.onNotebookChange}
            placeholder="Select notebook"
            menuPlacement="bottom"
            maxMenuHeight={200}
            value={selectedNotebook ? formatNotebookOption(selectedNotebook) : undefined}
          />
        </Field>
        {notebookMetaLoaded && !this.state.loadingMetadata && (
          <>
            <Field className="sl-output" label="Output">
              <Select
                options={selectedNotebook.metadata.outputs.map(this.formatOutputOption)}
                onChange={this.onOutputChange}
                menuPlacement="bottom"
                maxMenuHeight={200}
                value={this.formatOutputOption(
                  selectedNotebook.metadata.outputs.find((output: any) => output.id === query.output)
                )}
              />
            </Field>
            <Field className="sl-cache-timeout" label="Cache timeout (s)">
              <Input
                type="number"
                min="-1"
                step="1"
                defaultValue={query.cacheTimeout}
                onBlur={this.onCacheTimeoutChange}
              ></Input>
            </Field>
            {selectedNotebook.metadata.parameters?.length && (
              <div className="sl-parameters">
                <Label>Parameters</Label>
                {selectedNotebook.metadata.parameters.map((param: any) => this.getParameter(selectedNotebook, param))}
              </div>
            )}
          </>
        )}
        {this.state.loadingMetadata && <LoadingPlaceholder text="Loading metadata" style={{ width: '100%' }} />}
        {this.state.queryError && <Alert title={this.state.queryError}></Alert>}
      </div>
    );
  }
}
