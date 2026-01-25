#!/usr/bin/env python3
"""
ROI Tracking Framework - Executive Dashboard Demo
Demonstrates comprehensive ROI tracking and business impact measurement
"""

import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime, timedelta
import random
import numpy as np

def create_sample_roi_data():
    """Generate sample ROI data for demonstration"""

    # Sample automation initiatives
    initiatives = [
        {
            'name': 'CI/CD Pipeline Automation',
            'investment': 6000,
            'monthly_savings': 800,
            'category': 'Workflow Automation',
            'start_date': '2024-01-15',
            'status': 'Active'
        },
        {
            'name': 'Infrastructure Cost Optimization',
            'investment': 3000,
            'monthly_savings': 450,
            'category': 'Cost Optimization',
            'start_date': '2024-02-01',
            'status': 'Active'
        },
        {
            'name': 'Automated Testing Suite',
            'investment': 4500,
            'monthly_savings': 600,
            'category': 'Quality Automation',
            'start_date': '2024-02-15',
            'status': 'Active'
        },
        {
            'name': 'Self-Service Admin Tools',
            'investment': 7500,
            'monthly_savings': 1200,
            'category': 'Operational Automation',
            'start_date': '2024-03-01',
            'status': 'Active'
        },
        {
            'name': 'Maintenance Automation',
            'investment': 5000,
            'monthly_savings': 750,
            'category': 'Maintenance',
            'start_date': '2024-03-15',
            'status': 'Active'
        }
    ]

    return initiatives

def create_trend_data():
    """Generate sample trend data"""
    dates = pd.date_range(start='2024-01-01', end='2024-12-31', freq='W')

    # Cumulative savings trend
    cumulative_savings = []
    weekly_savings = []
    current_total = 0

    for i, date in enumerate(dates):
        # Gradually increasing savings as more automation is implemented
        if i < 10:  # First 10 weeks
            weekly = 200 + random.randint(-50, 50)
        elif i < 20:  # Next 10 weeks
            weekly = 500 + random.randint(-100, 100)
        elif i < 30:  # Next 10 weeks
            weekly = 800 + random.randint(-150, 150)
        else:  # Rest of year
            weekly = 950 + random.randint(-100, 200)

        current_total += weekly
        weekly_savings.append(weekly)
        cumulative_savings.append(current_total)

    return pd.DataFrame({
        'date': dates,
        'weekly_savings': weekly_savings,
        'cumulative_savings': cumulative_savings
    })

def main():
    """Main dashboard function"""

    st.set_page_config(
        page_title="ROI Tracking Dashboard",
        page_icon="📈",
        layout="wide",
        initial_sidebar_state="expanded"
    )

    st.title("📈 ROI Tracking Dashboard")
    st.markdown("**Enterprise Hub - Automation & Cost Optimization ROI**")

    # Load sample data
    initiatives = create_sample_roi_data()
    trend_data = create_trend_data()

    # Calculate summary metrics
    total_investment = sum(init['investment'] for init in initiatives)
    monthly_savings = sum(init['monthly_savings'] for init in initiatives)
    annual_savings = monthly_savings * 12
    roi_percentage = ((annual_savings - total_investment) / total_investment) * 100
    payback_months = total_investment / monthly_savings

    # Top-level metrics
    col1, col2, col3, col4 = st.columns(4)

    with col1:
        st.metric(
            "Annual Savings",
            f"${annual_savings:,}",
            f"+${monthly_savings:,}/month"
        )

    with col2:
        st.metric(
            "ROI",
            f"{roi_percentage:.0f}%",
            "Return on Investment"
        )

    with col3:
        st.metric(
            "Payback Period",
            f"{payback_months:.1f} months",
            "Time to break even"
        )

    with col4:
        net_value = annual_savings - total_investment
        st.metric(
            "Net Annual Value",
            f"${net_value:,}",
            f"${total_investment:,} invested"
        )

    # ROI trends over time
    st.subheader("📊 ROI Trends Over Time")

    fig_trends = go.Figure()

    fig_trends.add_trace(go.Scatter(
        x=trend_data['date'],
        y=trend_data['cumulative_savings'],
        mode='lines',
        name='Cumulative Savings',
        line=dict(color='green', width=3),
        fill='tonexty'
    ))

    # Add investment line
    investment_line = [total_investment] * len(trend_data)
    fig_trends.add_trace(go.Scatter(
        x=trend_data['date'],
        y=investment_line,
        mode='lines',
        name='Total Investment',
        line=dict(color='red', dash='dash'),
    ))

    fig_trends.update_layout(
        title="Cumulative Savings vs Investment",
        xaxis_title="Date",
        yaxis_title="Amount ($)",
        hovermode='x unified'
    )

    st.plotly_chart(fig_trends, use_container_width=True)

    # Savings breakdown by category
    col1, col2 = st.columns(2)

    with col1:
        st.subheader("💰 Savings by Category")

        # Create category breakdown
        category_data = {}
        for init in initiatives:
            category = init['category']
            if category not in category_data:
                category_data[category] = 0
            category_data[category] += init['monthly_savings'] * 12

        categories = list(category_data.keys())
        values = list(category_data.values())

        fig_pie = px.pie(
            values=values,
            names=categories,
            title="Annual Savings by Category"
        )
        st.plotly_chart(fig_pie, use_container_width=True)

    with col2:
        st.subheader("🚀 Initiative Performance")

        # Calculate ROI for each initiative
        init_performance = []
        for init in initiatives:
            annual_saving = init['monthly_savings'] * 12
            initiative_roi = ((annual_saving - init['investment']) / init['investment']) * 100
            payback = init['investment'] / init['monthly_savings']

            init_performance.append({
                'Initiative': init['name'],
                'Investment': init['investment'],
                'Annual Savings': annual_saving,
                'ROI (%)': initiative_roi,
                'Payback (months)': payback,
                'Status': init['status']
            })

        performance_df = pd.DataFrame(init_performance)

        fig_bar = px.bar(
            performance_df,
            x='Initiative',
            y='ROI (%)',
            color='ROI (%)',
            title="ROI by Initiative",
            color_continuous_scale='viridis'
        )
        fig_bar.update_layout(xaxis_tickangle=-45)
        st.plotly_chart(fig_bar, use_container_width=True)

    # Detailed metrics table
    st.subheader("📋 Detailed Performance Metrics")

    # Style the dataframe
    styled_df = performance_df.style.format({
        'Investment': '${:,.0f}',
        'Annual Savings': '${:,.0f}',
        'ROI (%)': '{:.0f}%',
        'Payback (months)': '{:.1f}'
    }).background_gradient(subset=['ROI (%)'], cmap='RdYlGn')

    st.dataframe(styled_df, use_container_width=True)

    # Business impact metrics
    st.subheader("🎯 Business Impact Analysis")

    impact_col1, impact_col2, impact_col3 = st.columns(3)

    with impact_col1:
        st.markdown("### ⏱️ Time Efficiency")
        time_metrics = [
            ("Development Time Saved", "67%", "40h → 13h per feature"),
            ("Deployment Time Reduced", "89%", "45min → 5min per deploy"),
            ("Testing Time Automated", "83%", "2h → 20min per cycle")
        ]

        for metric, improvement, detail in time_metrics:
            st.metric(metric, improvement, detail)

    with impact_col2:
        st.markdown("### 💵 Cost Optimization")
        cost_metrics = [
            ("Infrastructure Costs", "-25%", "$500 → $375/month"),
            ("API Costs", "-35%", "$200 → $130/month"),
            ("Support Overhead", "-80%", "$2000 → $400/month")
        ]

        for metric, improvement, detail in cost_metrics:
            st.metric(metric, improvement, detail)

    with impact_col3:
        st.markdown("### 🛡️ Quality & Risk")
        quality_metrics = [
            ("Error Rate Reduction", "-75%", "20 → 5 errors/month"),
            ("Security Issues", "-90%", "10 → 1 issues/month"),
            ("Downtime Prevention", "99.9%", "1h → 6min/month")
        ]

        for metric, improvement, detail in quality_metrics:
            st.metric(metric, improvement, detail)

    # Executive summary
    st.subheader("📊 Executive Summary")

    summary_text = f"""
    ### Key Achievements

    **Financial Impact:**
    - **${annual_savings:,} annual cost savings** with ${total_investment:,} investment
    - **{roi_percentage:.0f}% ROI** achieved in {payback_months:.1f} months
    - **${net_value:,} net annual value** to the business

    **Operational Excellence:**
    - **67% reduction** in development time through automation
    - **89% faster deployments** with zero-downtime deployments
    - **80% reduction** in manual support overhead

    **Risk Mitigation:**
    - **90% reduction** in security incidents through automated scanning
    - **99.9% uptime** achieved through proactive monitoring
    - **75% fewer errors** in production through automated testing

    **Strategic Value:**
    - **5x deployment frequency** enabling faster feature delivery
    - **Competitive advantage** through faster time-to-market
    - **Team productivity** increased by 50% through automation

    ### Next Quarter Priorities
    1. **Expand automation** to customer service operations (+$25k annual savings)
    2. **Implement predictive analytics** for proactive optimization (+$15k value)
    3. **Scale monitoring** to additional services (+$10k risk mitigation)

    **Total Projected Impact:** ${annual_savings + 50000:,} annual savings within 12 months
    """

    st.markdown(summary_text)

    # Cost savings calculator
    with st.sidebar:
        st.header("💡 ROI Calculator")
        st.markdown("Calculate ROI for new automation initiatives")

        investment = st.number_input("Investment ($)", value=5000, step=500)
        monthly_saving = st.number_input("Monthly Savings ($)", value=400, step=50)

        if monthly_saving > 0:
            annual_saving = monthly_saving * 12
            calc_roi = ((annual_saving - investment) / investment) * 100
            calc_payback = investment / monthly_saving

            st.metric("Projected Annual Savings", f"${annual_saving:,}")
            st.metric("Projected ROI", f"{calc_roi:.0f}%")
            st.metric("Payback Period", f"{calc_payback:.1f} months")

            if calc_roi > 100:
                st.success("🎯 Excellent ROI opportunity!")
            elif calc_roi > 50:
                st.info("✅ Good ROI potential")
            else:
                st.warning("⚠️ Consider optimizing approach")

if __name__ == "__main__":
    main()