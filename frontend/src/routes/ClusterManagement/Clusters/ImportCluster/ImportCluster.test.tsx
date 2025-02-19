/* Copyright Contributors to the Open Cluster Management project */

import { render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route } from 'react-router-dom'
import { RecoilRoot } from 'recoil'
import { discoveredClusterState, discoveryConfigState, managedClusterSetsState, secretsState } from '../../../../atoms'
import { mockBadRequestStatus, nockCreate, nockDelete, nockGet, nockIgnoreRBAC } from '../../../../lib/nock-util'
import { mockCRHCredential, mockDiscoveryConfig, mockManagedClusterSet } from '../../../../lib/test-metadata'
import {
    clickByTestId,
    clickByText,
    typeByTestId,
    waitForNocks,
    waitForTestId,
    waitForText,
} from '../../../../lib/test-util'
import { NavigationPath } from '../../../../NavigationPath'
import {
    DiscoveredCluster,
    DiscoveredClusterApiVersion,
    DiscoveredClusterKind,
} from '../../../../resources/discovered-cluster'
import {
    KlusterletAddonConfig,
    KlusterletAddonConfigApiVersion,
    KlusterletAddonConfigKind,
} from '../../../../resources/klusterlet-add-on-config'
import { ManagedCluster, ManagedClusterApiVersion, ManagedClusterKind } from '../../../../resources/managed-cluster'
import { managedClusterSetLabel } from '../../../../resources/managed-cluster-set'
import {
    Project,
    ProjectApiVersion,
    ProjectKind,
    ProjectRequest,
    ProjectRequestApiVersion,
    ProjectRequestKind,
} from '../../../../resources/project'
import { Secret, SecretApiVersion, SecretKind } from '../../../../resources/secret'
import DiscoveredClustersPage from '../../../Discovery/DiscoveredClusters/DiscoveredClusters'
import ImportClusterPage from './ImportCluster'

const mockProject: ProjectRequest = {
    apiVersion: ProjectRequestApiVersion,
    kind: ProjectRequestKind,
    metadata: { name: 'foobar' },
}

const mockDiscoveredClusters: DiscoveredCluster[] = [
    {
        apiVersion: DiscoveredClusterApiVersion,
        kind: DiscoveredClusterKind,
        metadata: {
            name: 'foobar',
            namespace: 'foobar',
        },
        spec: {
            activityTimestamp: '2020-07-30T19:09:43Z',
            cloudProvider: 'aws',
            apiUrl: 'https://api.foobar.dev01.red-chesterfield.com',
            displayName: 'foobar',
            console: 'https://console-openshift-console.apps.foobar.dev01.red-chesterfield.com',
            creationTimestamp: '2020-07-30T19:09:43Z',
            name: 'foobar',
            openshiftVersion: '4.5.5',
            providerConnections: [
                {
                    apiVersion: 'v1',
                    kind: 'Secret',
                    name: 'ocm-api-token',
                    namespace: 'open-cluster-management',
                    resourceVersion: '2673462626',
                    uid: '8e103e5d-0267-4872-b185-1240e413d7b4',
                },
            ],
            status: 'Active',
        },
    },
    {
        apiVersion: DiscoveredClusterApiVersion,
        kind: DiscoveredClusterKind,
        metadata: { name: 'test-cluster-02', namespace: 'foobar' },
        spec: {
            activityTimestamp: '2020-07-30T19:09:43Z',
            cloudProvider: 'gcp',
            console: 'https://console-openshift-console.apps.test-cluster-01.dev01.red-chesterfield.com',
            creationTimestamp: '2020-07-30T19:09:43Z',
            name: 'test-cluster-02',
            openshiftVersion: '4.6.1',
            status: 'Stale',
        },
    },
]

const mockSecretResponse: Secret = {
    apiVersion: SecretApiVersion,
    kind: SecretKind,
    metadata: {
        name: 'foobar-import',
        namespace: 'foobar',
    },
    data: { 'crds.yaml': 'crd yaml', 'import.yaml': 'import yaml' },
    type: 'Opaque',
}

const mockAutoSecretResponse: Secret = {
    apiVersion: SecretApiVersion,
    kind: SecretKind,
    metadata: {
        name: 'auto-import-secret',
        namespace: 'foobar',
    },
    data: { autoImportRetry: '2', kubeconfig: 'Test text' },
    type: 'Opaque',
}

const mockAutoSecret: Secret = {
    apiVersion: SecretApiVersion,
    kind: SecretKind,
    metadata: {
        name: 'auto-import-secret',
        namespace: 'foobar',
    },
    stringData: {
        autoImportRetry: '2',
        kubeconfig: 'Test text',
    },
    type: 'Opaque',
}

const mockAutoTokenSecretResponse: Secret = {
    apiVersion: SecretApiVersion,
    kind: SecretKind,
    metadata: {
        name: 'auto-import-secret',
        namespace: 'foobar',
    },
    data: { autoImportRetry: '2', token: 'Test token', server: 'Test server' },
    type: 'Opaque',
}

const mockAutoTokenSecret: Secret = {
    apiVersion: SecretApiVersion,
    kind: SecretKind,
    metadata: {
        name: 'auto-import-secret',
        namespace: 'foobar',
    },
    stringData: {
        autoImportRetry: '2',
        token: 'Test token',
        server: 'Test server',
    },
    type: 'Opaque',
}

const mockManagedCluster: ManagedCluster = {
    apiVersion: ManagedClusterApiVersion,
    kind: ManagedClusterKind,
    metadata: {
        name: 'foobar',
        labels: { cloud: 'auto-detect', vendor: 'auto-detect', name: 'foobar', foo: 'bar' },
    },
    spec: { hubAcceptsClient: true },
}

const mockKlusterletAddonConfig: KlusterletAddonConfig = {
    apiVersion: KlusterletAddonConfigApiVersion,
    kind: KlusterletAddonConfigKind,
    metadata: { name: 'foobar', namespace: 'foobar' },
    spec: {
        clusterName: 'foobar',
        clusterNamespace: 'foobar',
        clusterLabels: { cloud: 'auto-detect', vendor: 'auto-detect', name: 'foobar', foo: 'bar' },
        applicationManager: { enabled: true, argocdCluster: false },
        policyController: { enabled: true },
        searchCollector: { enabled: true },
        certPolicyController: { enabled: true },
        iamPolicyController: { enabled: true },
        version: '2.2.0',
    },
}

const mockProjectResponse: Project = {
    apiVersion: ProjectApiVersion,
    kind: ProjectKind,
    metadata: {
        name: 'foobar',
        selfLink: '/apis/project.openshift.io/v1/projectrequests/foobar',
        uid: 'f628792b-79d2-4c41-a07a-c7f1afac5e8a',
        resourceVersion: '16251055',
        annotations: {
            'openshift.io/description': '',
            'openshift.io/display-name': '',
            'openshift.io/requester': 'kube:admin',
            'openshift.io/sa.scc.mcs': 's0:c25,c15',
            'openshift.io/sa.scc.supplemental-groups': '1000630000/10000',
            'openshift.io/sa.scc.uid-range': '1000630000/10000',
        },
    },
}

const mockManagedClusterResponse: ManagedCluster = {
    apiVersion: ManagedClusterApiVersion,
    kind: ManagedClusterKind,
    metadata: {
        labels: { cloud: 'auto-detect', name: 'foobar', vendor: 'auto-detect', foo: 'bar' },
        name: 'foobar',
        uid: 'e60ef618-324b-49d4-8a28-48839c546565',
    },
    spec: { hubAcceptsClient: true, leaseDurationSeconds: 60 },
}

const mockKlusterletAddonConfigResponse: KlusterletAddonConfig = {
    apiVersion: 'agent.open-cluster-management.io/v1',
    kind: 'KlusterletAddonConfig',
    metadata: {
        name: 'foobar',
        namespace: 'foobar',
        uid: 'fba00095-386b-4d68-b2da-97003bc6a987',
    },
    spec: {
        applicationManager: { enabled: true, argocdCluster: false },
        certPolicyController: { enabled: true },
        clusterLabels: { cloud: 'auto-detect', name: 'foobar', vendor: 'auto-detect', foo: 'bar' },
        clusterName: 'foobar',
        clusterNamespace: 'foobar',
        iamPolicyController: { enabled: true },
        policyController: { enabled: true },
        searchCollector: { enabled: true },
        version: '2.2.0',
    },
}

describe('ImportCluster', () => {
    const Component = () => {
        return (
            <RecoilRoot
                initializeState={(snapshot) => {
                    snapshot.set(managedClusterSetsState, [mockManagedClusterSet])
                }}
            >
                <MemoryRouter initialEntries={['/import-cluster']}>
                    <Route path="/import-cluster">
                        <ImportClusterPage />
                    </Route>
                </MemoryRouter>
            </RecoilRoot>
        )
    }

    beforeEach(() => {
        window.sessionStorage.clear()
        nockIgnoreRBAC()
    })

    test('can create resources and generate the import command', async () => {
        const projectNock = nockCreate(mockProject, mockProjectResponse)
        const mockCluster = JSON.parse(JSON.stringify(mockManagedCluster))
        const mockClusterResponse = JSON.parse(JSON.stringify(mockManagedClusterResponse))
        const mockKac = JSON.parse(JSON.stringify(mockKlusterletAddonConfig))
        const mockKacResponse = JSON.parse(JSON.stringify(mockKlusterletAddonConfigResponse))
        mockCluster.metadata.labels[managedClusterSetLabel] = mockManagedClusterSet.metadata.name
        mockClusterResponse.metadata.labels[managedClusterSetLabel] = mockManagedClusterSet.metadata.name
        mockKac.spec.clusterLabels[managedClusterSetLabel] = mockManagedClusterSet.metadata.name
        mockKacResponse.spec.clusterLabels[managedClusterSetLabel] = mockManagedClusterSet.metadata.name
        const managedClusterNock = nockCreate(mockCluster, mockClusterResponse)
        const kacNock = nockCreate(mockKac, mockKacResponse)
        const importSecretNock = nockGet(mockSecretResponse)

        const { getByTestId, getByText, queryByTestId } = render(<Component />)

        // TODO REMOVE
        await new Promise((resolve) => setTimeout(resolve, 500))
        await typeByTestId('clusterName', 'foobar')

        await clickByText('import.form.managedClusterSet.placeholder')
        await clickByText(mockManagedClusterSet.metadata.name!)
        await clickByTestId('label-input-button')
        await typeByTestId('additionalLabels', 'foo=bar{enter}')
        expect(getByText('import.form.submit')).toHaveAttribute('aria-disabled', 'false')
        await clickByText('import.form.submit')

        await waitForNocks([projectNock, managedClusterNock, kacNock, importSecretNock])

        await waitFor(() => expect(getByTestId('import-command')).toBeInTheDocument())

        // reset form
        await waitForText('import.footer.importanother')
        await clickByText('import.footer.importanother')
        await waitFor(() => expect(queryByTestId('import-command')).toBeNull())
        expect(getByTestId('clusterName')).toHaveValue('')
    })

    test('can create resources when auto importing using kubeconfig', async () => {
        const projectNock = nockCreate(mockProject, mockProjectResponse)
        const managedClusterNock = nockCreate(mockManagedCluster, mockManagedClusterResponse)
        const kacNock = nockCreate(mockKlusterletAddonConfig, mockKlusterletAddonConfigResponse)
        const importAutoSecretNock = nockCreate(mockAutoSecret, mockAutoSecretResponse)

        render(<Component />)

        await typeByTestId('clusterName', 'foobar')
        await clickByTestId('label-input-button')
        await typeByTestId('additionalLabels', 'foo=bar{enter}')
        await clickByText('import.mode.manual')
        await clickByText('import.mode.kubeconfig')
        await clickByTestId('kubeConfigEntry')
        await typeByTestId('kubeConfigEntry', 'Test text')
        await clickByText('import.auto.button')

        await waitForNocks([projectNock, managedClusterNock, kacNock, importAutoSecretNock])
    })

    test('can create resources when auto importing using token/server', async () => {
        const projectNock = nockCreate(mockProject, mockProjectResponse)
        const managedClusterNock = nockCreate(mockManagedCluster, mockManagedClusterResponse)
        const kacNock = nockCreate(mockKlusterletAddonConfig, mockKlusterletAddonConfigResponse)
        const importAutoTokenSecretNock = nockCreate(mockAutoTokenSecret, mockAutoTokenSecretResponse)

        render(<Component />)

        await typeByTestId('clusterName', 'foobar')
        await clickByTestId('label-input-button')
        await typeByTestId('additionalLabels', 'foo=bar{enter}')
        await clickByText('import.mode.manual')
        await clickByText('import.mode.token')
        await clickByTestId('token')
        await typeByTestId('token', 'Test token')
        await clickByTestId('server')
        await typeByTestId('server', 'Test server')
        await clickByText('import.auto.button')

        await waitForNocks([projectNock, managedClusterNock, kacNock, importAutoTokenSecretNock])
    })

    test('handles project creation error', async () => {
        const projectNock = nockCreate(mockProject, mockBadRequestStatus)
        const { getByText } = render(<Component />)
        await typeByTestId('clusterName', 'foobar')
        expect(getByText('import.form.submit')).toHaveAttribute('aria-disabled', 'false')
        await clickByText('import.form.submit')
        await waitForText('import.generating')
        await waitForNocks([projectNock])
        await waitForText(mockBadRequestStatus.message, true)
    })

    test('handles resource creation errors', async () => {
        const createProjectNock = nockCreate(mockProject, mockProjectResponse)
        const badRequestNock = nockCreate(mockManagedCluster, mockBadRequestStatus)
        const deleteProjectNock = nockDelete(mockProjectResponse)

        render(<Component />)

        await typeByTestId('clusterName', 'foobar')
        await clickByTestId('label-input-button')
        await typeByTestId('additionalLabels', 'foo=bar{enter}')
        await clickByText('import.form.submit')
        await waitForNocks([createProjectNock, badRequestNock, deleteProjectNock])
        await waitForText(mockBadRequestStatus.message, true)
    })
})

let store: Record<string, string> = {}

Object.defineProperty(window, 'sessionStorage', {
    value: {
        getItem(key: string) {
            return store[key] || null
        },
        setItem(key: string, value: string | Record<string, string>) {
            store[key] = value.toString()
        },
        removeItem(key: string) {
            delete store[key]
        },
        clear() {
            store = {}
        },
    },
})

describe('Import Discovered Cluster', () => {
    beforeEach(() => {
        nockIgnoreRBAC()
    })
    window.sessionStorage.setItem('DiscoveredClusterConsoleURL', 'https://test-cluster.com')
    const Component = () => {
        return (
            <RecoilRoot
                initializeState={(snapshot) => {
                    snapshot.set(managedClusterSetsState, [mockManagedClusterSet])
                    snapshot.set(secretsState, [mockCRHCredential])
                    snapshot.set(discoveryConfigState, [mockDiscoveryConfig])
                    snapshot.set(discoveredClusterState, mockDiscoveredClusters)
                }}
            >
                <MemoryRouter>
                    <Route>
                        <DiscoveredClustersPage />
                    </Route>
                    <Route path={NavigationPath.importCluster}>
                        <ImportClusterPage />
                    </Route>
                </MemoryRouter>
            </RecoilRoot>
        )
    }
    test('create discovered cluster', async () => {
        const { getAllByText, getAllByLabelText } = render(<Component />) // Render component

        await waitFor(() => expect(getAllByText(mockDiscoveredClusters[0].metadata.name!)[0]!).toBeInTheDocument()) // Wait for DiscoveredCluster to appear in table
        userEvent.click(getAllByLabelText('Actions')[0]) // Click on Kebab menu

        await clickByText('discovery.import')
        await waitForText('import.form.submit')

        const projectNock = nockCreate(mockProject, mockProjectResponse)
        const managedClusterNock = nockCreate(mockManagedCluster, mockManagedClusterResponse)
        const kacNock = nockCreate(mockKlusterletAddonConfig, mockKlusterletAddonConfigResponse)
        const importCommandNock = nockGet(mockSecretResponse)

        // Add labels
        await clickByTestId('label-input-button')
        await typeByTestId('additionalLabels', 'foo=bar{enter}')

        await clickByText('import.form.submit')

        await waitForNocks([projectNock, managedClusterNock, kacNock, importCommandNock])

        await waitForTestId('import-command')
        await waitForTestId('launch-console')
    })
})
