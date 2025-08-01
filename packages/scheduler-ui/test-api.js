// Test de conectividad frontend-backend
const testApiConnectivity = async () => {
  try {
    console.log('🔄 Testing flows endpoint...')
    const flowsResponse = await fetch('http://localhost:3001/api/v1/flows')
    const flowsData = await flowsResponse.json()
    console.log('✅ Flows endpoint working:', {
      status: flowsResponse.status,
      flowsCount: flowsData.data.data.length,
      pagination: flowsData.data.pagination
    })

    console.log('🔄 Testing catalog endpoint...')
    const catalogResponse = await fetch('http://localhost:3001/api/v1/catalog/nodes')
    const catalogData = await catalogResponse.json()
    console.log('✅ Catalog endpoint working:', {
      status: catalogResponse.status,
      nodesCount: catalogData.data.length
    })

    console.log('🔄 Testing schedules endpoint...')
    const schedulesResponse = await fetch('http://localhost:3001/api/v1/scheduler/schedules')
    const schedulesData = await schedulesResponse.json()
    console.log('✅ Schedules endpoint working:', {
      status: schedulesResponse.status,
      schedulesCount: schedulesData.data.data.length,
      pagination: schedulesData.data.pagination
    })

    console.log('🎉 All endpoints are working correctly!')
    return true
  } catch (error) {
    console.error('❌ API connectivity test failed:', error)
    return false
  }
}

testApiConnectivity()
